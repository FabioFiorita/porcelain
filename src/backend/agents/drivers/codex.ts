import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { accessSync, constants } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import type {
  AgentEvent,
  ApprovalDecision,
  ProviderLimits,
  ProviderStatus,
  TimelineItem,
} from '../../../shared/agent-protocol'
import { agentSpawnEnv } from '../../login-shell-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { expandSlashCommand, listCommandFiles } from './agent-commands-fs'
import {
  APPROVAL_METHODS,
  buildApprovalItem,
  buildThreadResumeParams,
  buildThreadStartParams,
  buildTurnStartParams,
  buildUserInput,
  type CodexRateLimitSnapshot,
  encodeMessage,
  type Incoming,
  isLegacyApprovalMethod,
  LineDecoder,
  mergeRateLimitSnapshot,
  modeToPolicy,
  parseAccountLabel,
  parseAuthenticated,
  parseIncoming,
  parseModelList,
  parseRateLimitsResponse,
  parseRateLimitsUpdated,
  parseThreadId,
  parseTurnId,
  type RpcId,
  routingKeys,
  snapshotToLimits,
  toLegacyDecision,
  toV2Decision,
  translateNotification,
} from './codex-rpc'

/**
 * Codex driver — drives the user's installed `codex` CLI via `codex app-server`, a
 * long-lived JSON-RPC-over-stdio server. ONE server process is shared by every thread on
 * this driver (it's a server, not a per-turn command): spawned lazily on first use,
 * reused across turns/threads, and respawned if it exits. Notifications are multiplexed
 * back to the right turn by conversation (thread) id; server→client approval requests are
 * correlated by JSON-RPC id. All wire framing + translation lives in the pure sibling
 * `codex-rpc.ts`; this file is the impure half (process, RPC, routing).
 *
 * WHY a bidirectional id table: `codex app-server` speaks JSON-RPC without the
 * `jsonrpc` envelope AND issues requests back to US (approvals). So we correlate our
 * outbound requests by id (`pending`) and answer the server's inbound requests by id
 * (per-turn `approvals`). A malformed line or an unexpected notification is logged and
 * dropped — never thrown — matching how session.ts tolerates bad input.
 */

// GUI-launched daemons inherit a minimal PATH, so PATH-resolution can miss a Homebrew
// install; fall back to the well-known locations Codex installs into.
const WELL_KNOWN_BINS = ['/opt/homebrew/bin/codex', '/usr/local/bin/codex']

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** Resolve the `codex` binary: explicit override → PATH → well-known locations. */
function resolveCodexBin(env: NodeJS.ProcessEnv): string | null {
  const override = env.PORCELAIN_CODEX_BIN
  if (override && isExecutable(override)) return override
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue
    const candidate = join(dir, 'codex')
    if (isExecutable(candidate)) return candidate
  }
  for (const candidate of [...WELL_KNOWN_BINS, join(homedir(), '.local', 'bin', 'codex')]) {
    if (isExecutable(candidate)) return candidate
  }
  return null
}

// Codex custom prompts live flat in `~/.codex/prompts/*.md` (invoked as `/name` in the TUI).
function codexPromptsDir(): string {
  return join(homedir(), '.codex', 'prompts')
}

// Auto-title: capped so a hung `codex exec` can't leak a process (execFile SIGTERMs on
// timeout).
const TITLE_TIMEOUT_MS = 20_000
const titlePrompt = (text: string): string =>
  `Reply with ONLY a 2-5 word title for this coding request, no quotes or punctuation:\n\n${text.slice(0, 2000)}`

/** One approval this turn is blocked on, keyed by its stringified server-request id. */
interface PendingApproval {
  serverReqId: RpcId
  method: string
  // The item we emitted, so we can re-emit it flipped (accepted/declined/canceled).
  item: Extract<TimelineItem, { kind: 'approval' }>
  resolved: boolean
}

/** A single in-flight turn: its routing ids, its callbacks, and its pending approvals. */
class CodexTurn {
  threadId: string | null = null
  turnId: string | null = null
  done = false
  abortRequested = false
  readonly approvals = new Map<string, PendingApproval>()

  constructor(readonly opts: StartTurnOptions) {}

  emit(event: AgentEvent): void {
    this.opts.emit(event)
  }

  // End the turn exactly once: cancel any approval still pending, then signal onDone.
  finish(ok: boolean): void {
    if (this.done) return
    this.done = true
    for (const approval of this.approvals.values()) {
      if (approval.resolved) continue
      approval.resolved = true
      this.emit({ t: 'item', item: { ...approval.item, status: 'canceled' } })
    }
    this.opts.onDone({ ok })
  }
}

/** The shared `codex app-server` process and its two id-correlation tables. */
class CodexServer {
  private proc: ChildProcessWithoutNullStreams | null = null
  private readonly decoder = new LineDecoder()
  private nextId = 1
  private readonly pending = new Map<
    RpcId,
    { resolve(value: unknown): void; reject(error: Error): void }
  >()
  // Active turns keyed by Codex thread id — the multiplexing table. One turn per thread
  // (the manager enforces it), so a thread id uniquely routes a notification/approval.
  private readonly turns = new Map<string, CodexTurn>()
  private ready: Promise<void> | null = null
  // The last known rate-limit snapshot: seeded by `account/rateLimits/read` and kept fresh
  // by merging sparse `account/rateLimits/updated` pushes (see handleNotification). `at` is
  // when it was last touched, so `readRateLimits` can serve a recent push without a round-trip.
  private rateLimits: { snapshot: CodexRateLimitSnapshot; at: number } | null = null

  constructor(
    private readonly bin: string,
    private readonly env: Record<string, string>,
  ) {}

  /** Spawn (if needed) and run the `initialize` handshake once; reused by all callers. */
  ensureReady(): Promise<void> {
    if (this.ready === null) this.ready = this.start()
    return this.ready
  }

  private async start(): Promise<void> {
    const proc = spawn(this.bin, ['app-server'], { env: this.env })
    this.proc = proc
    // An EPIPE from a dying CLI must not crash the daemon with an unhandled 'error' — same
    // precedent as session.ts's socket error listener; 'exit' drives the real teardown.
    proc.stdin.on('error', () => {})
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      for (const line of this.decoder.push(chunk)) this.handleLine(line)
    })
    // stderr is diagnostic noise (dbus, mcp startup); read it so the pipe never stalls.
    proc.stderr.on('data', () => {})
    proc.on('exit', () => this.handleExit())
    proc.on('error', () => this.handleExit())
    // `initialize` is the first frame; the server answers methods immediately after, so
    // resolving on its response is enough (no separate `initialized` notification).
    await this.request('initialize', {
      clientInfo: { name: 'porcelain', title: 'Porcelain', version: '1' },
      capabilities: { experimentalApi: true },
    })
  }

  private handleExit(): void {
    const error = new Error('codex app-server exited')
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
    for (const turn of this.turns.values()) {
      turn.emit({
        t: 'item',
        item: { kind: 'error', id: `exit:${turn.threadId ?? ''}`, message: error.message },
      })
      turn.finish(false)
    }
    this.turns.clear()
    this.proc = null
    this.ready = null
  }

  private write(message: Record<string, unknown>): void {
    this.proc?.stdin.write(encodeMessage(message))
  }

  /** Issue a request and resolve with its `result` (rejects on an error response/exit). */
  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.write({ id, method, params })
    })
  }

  private handleLine(line: string): void {
    let incoming: Incoming | null
    try {
      incoming = parseIncoming(line)
    } catch {
      return // never let a bad line take down the read loop
    }
    if (!incoming) return
    if (incoming.kind === 'response') {
      const waiter = this.pending.get(incoming.id)
      if (!waiter) return
      this.pending.delete(incoming.id)
      if (incoming.error) waiter.reject(new Error(incoming.error.message))
      else waiter.resolve(incoming.result)
      return
    }
    if (incoming.kind === 'request') {
      this.handleServerRequest(incoming.id, incoming.method, incoming.params)
      return
    }
    this.handleNotification(incoming.method, incoming.params)
  }

  // A server→client request. The only ones we answer are approvals; anything else we
  // decline-by-ignoring is harmless here because we never opt into those capabilities.
  private handleServerRequest(id: RpcId, method: string, params: unknown): void {
    if (!APPROVAL_METHODS.has(method)) return
    const { threadId } = routingKeys(params)
    const turn = threadId ? this.turns.get(threadId) : undefined
    if (!turn) return
    const requestId = String(id)
    const event = buildApprovalItem(requestId, method, params)
    turn.approvals.set(requestId, { serverReqId: id, method, item: event.item, resolved: false })
    turn.emit(event)
  }

  private handleNotification(method: string, params: unknown): void {
    // Rate-limit pushes are account-scoped (no thread/turn id): merge them into the cached
    // snapshot so `readRateLimits` can serve them without a round-trip. Handle before the
    // thread routing below, which would drop them for lacking a threadId.
    if (method === 'account/rateLimits/updated') {
      const update = parseRateLimitsUpdated(params)
      if (update) {
        this.rateLimits = {
          snapshot: mergeRateLimitSnapshot(this.rateLimits?.snapshot ?? null, update),
          at: Date.now(),
        }
      }
      return
    }
    const { threadId, turnId } = routingKeys(params)
    const turn = threadId ? this.turns.get(threadId) : undefined
    if (!turn) return
    // Drop stragglers from a superseded turn on the same thread (turnId mismatch).
    if (turn.turnId !== null && turnId !== undefined && turnId !== turn.turnId) return
    const { events, done } = translateNotification(method, params)
    for (const event of events) turn.emit(event)
    if (done) {
      this.turns.delete(turn.threadId ?? '')
      turn.finish(done.ok)
    }
  }

  register(turn: CodexTurn): void {
    if (turn.threadId) this.turns.set(turn.threadId, turn)
  }

  /** Answer a pending approval and flip its item to accepted/declined. */
  respondApproval(turn: CodexTurn, requestId: string, decision: ApprovalDecision): void {
    const approval = turn.approvals.get(requestId)
    if (!approval || approval.resolved) return
    approval.resolved = true
    const value = isLegacyApprovalMethod(approval.method)
      ? toLegacyDecision(decision)
      : toV2Decision(decision)
    this.write({ id: approval.serverReqId, result: { decision: value } })
    turn.emit({
      t: 'item',
      item: { ...approval.item, status: decision === 'decline' ? 'declined' : 'accepted' },
    })
  }

  /** Interrupt a running turn; the natural `turn/completed` is swallowed by finish's guard. */
  interrupt(turn: CodexTurn): void {
    if (turn.threadId && turn.turnId) {
      this.write({
        id: this.nextId++,
        method: 'turn/interrupt',
        params: { threadId: turn.threadId, turnId: turn.turnId },
      })
    }
    this.turns.delete(turn.threadId ?? '')
  }

  /**
   * The current rate-limit snapshot: serve a recent push-merged snapshot without a
   * round-trip (`freshMs`), else fetch a fresh `account/rateLimits/read` and cache it.
   * Returns null when the read fails or the account exposes no snapshot.
   */
  async readRateLimits(freshMs: number): Promise<CodexRateLimitSnapshot | null> {
    if (this.rateLimits && Date.now() - this.rateLimits.at < freshMs)
      return this.rateLimits.snapshot
    const result = await this.request('account/rateLimits/read', {})
    const snapshot = parseRateLimitsResponse(result)
    if (snapshot) this.rateLimits = { snapshot, at: Date.now() }
    return snapshot
  }
}

// A push-merged snapshot newer than this is returned without a fresh read (the app layer
// caches `agentLimits` for 60s anyway, so this only avoids a redundant round-trip within a
// burst of pushes).
const RATE_LIMITS_FRESH_MS = 60_000

// ── The shared server singleton ────────────────────────────────────────────────────

let server: CodexServer | null = null
// The in-flight creation, cached SYNCHRONOUSLY so two concurrent first callers share ONE
// app-server. `ensureServer` is now async (it awaits the login-shell PATH), so without this
// the await between the `if (server)` check and the assignment lets both racers construct a
// CodexServer and spawn a duplicate `codex app-server` (no reaper for it) — same dedupe
// discipline as opencode's `getServer`.
let serverPromise: Promise<CodexServer | null> | null = null

// Merge the login-shell PATH into the app-server's env so its `npx`/`node`-style MCP servers
// resolve under a Dock-launched daemon's minimal PATH (see login-shell-env.ts); resolving the
// binary from that same PATH also finds a Homebrew `codex` like a terminal.
async function createServer(): Promise<CodexServer | null> {
  const env = await agentSpawnEnv()
  const bin = resolveCodexBin(env)
  if (!bin) return null
  server = new CodexServer(bin, env)
  return server
}

function ensureServer(): Promise<CodexServer | null> {
  if (server) return Promise.resolve(server)
  if (serverPromise !== null) return serverPromise
  const pending = createServer()
  serverPromise = pending
  // Once settled, drop the in-flight cache: on success `server` is set (the fast path above
  // serves later calls); on null (no CLI) / failure, retry on the next call so a mid-session
  // install is picked up. Mirrors opencode's `servers.delete` on the pending entry.
  pending
    .then(() => {
      if (serverPromise === pending) serverPromise = null
    })
    .catch(() => {
      if (serverPromise === pending) serverPromise = null
    })
  return pending
}

// Collect the whole model catalog, following `nextCursor` (capped so a broken server
// can't loop forever).
async function collectModels(active: CodexServer): Promise<ProviderStatus['models']> {
  const models: ProviderStatus['models'] = []
  let cursor: string | null = null
  for (let page = 0; page < 10; page++) {
    const result = await active.request('model/list', {
      limit: 100,
      ...(cursor !== null ? { cursor } : {}),
    })
    const parsed = parseModelList(result)
    if (!parsed) break
    models.push(...parsed.models)
    if (parsed.nextCursor === null) break
    cursor = parsed.nextCursor
  }
  return models
}

export const codexDriver: AgentDriver = {
  provider: 'codex',

  async status(): Promise<ProviderStatus> {
    const active = await ensureServer()
    if (!active) return { provider: 'codex', installed: false, authenticated: false, models: [] }
    try {
      await active.ensureReady()
      const [auth, account, models] = await Promise.all([
        active.request('getAuthStatus', { includeToken: false, refreshToken: false }),
        active.request('account/read', { refreshToken: false }),
        collectModels(active),
      ])
      const label = parseAccountLabel(account)
      return {
        provider: 'codex',
        installed: true,
        authenticated: parseAuthenticated(auth),
        ...(label !== undefined ? { account: label } : {}),
        models,
      }
    } catch {
      // The binary exists but the server wouldn't answer — report installed-but-unknown.
      return { provider: 'codex', installed: true, authenticated: false, models: [] }
    }
  },

  // Codex prompts are flat `.md` files under `~/.codex/prompts` — no namespacing, so the
  // scan is non-recursive.
  listCommands(): Promise<AgentCommand[]> {
    return listCommandFiles([codexPromptsDir()], false)
  },

  // Codex exposes rate limits first-class on the shared app-server: `account/rateLimits/read`
  // seeds a snapshot, and mid-turn `account/rateLimits/updated` pushes keep it fresh (merged
  // in handleNotification). Returns null on any failure or for an account with no windows
  // (API key). No secrets involved — Codex's own OAuth stays inside the app-server process.
  async limits(): Promise<ProviderLimits | null> {
    const active = await ensureServer()
    if (!active) return null
    try {
      await active.ensureReady()
      const snapshot = await active.readRateLimits(RATE_LIMITS_FRESH_MS)
      return snapshot ? snapshotToLimits(snapshot) : null
    } catch {
      return null
    }
  },

  // A cheap one-shot title via `codex exec`: `--ephemeral` (no session file), read-only
  // sandbox + `--skip-git-repo-check` (safe anywhere), `-o <file>` to capture just the
  // final message. Default model (no `-m`) keeps the invocation simple; a title turn is
  // tiny. Resolves null on any failure so the manager keeps the derived title.
  async generateTitle({
    repoPath,
    text,
  }: {
    repoPath: string
    text: string
  }): Promise<string | null> {
    const env = await agentSpawnEnv()
    const bin = resolveCodexBin(env)
    if (!bin) return null
    const outFile = join(tmpdir(), `porcelain-codex-title-${randomUUID()}.txt`)
    try {
      return await new Promise<string | null>((resolve) => {
        execFile(
          bin,
          [
            'exec',
            '--ephemeral',
            '--sandbox',
            'read-only',
            '--skip-git-repo-check',
            '--color',
            'never',
            '-C',
            repoPath,
            '-o',
            outFile,
            titlePrompt(text),
          ],
          { env, timeout: TITLE_TIMEOUT_MS },
          (error) => {
            if (error) {
              resolve(null)
              return
            }
            readFile(outFile, 'utf8')
              .then((out) => resolve(out.trim() === '' ? null : out.trim()))
              .catch(() => resolve(null))
          },
        )
      })
    } finally {
      await rm(outFile, { force: true }).catch(() => {})
    }
  },

  startTurn(opts: StartTurnOptions): TurnHandle {
    const turn = new CodexTurn(opts)
    // Resolved inside run() (ensureServer is async — it awaits the login-shell PATH); the
    // returned handle guards on it being set, and an abort during that window is caught by
    // turn.abortRequested below (the existing pre-turn abort path).
    let active: CodexServer | null = null

    // The whole handshake is async; startTurn returns synchronously, so every emit here
    // lands after the manager has recorded the returned handle (per StartTurnOptions).
    const run = async (): Promise<void> => {
      active = await ensureServer()
      if (!active) {
        turn.emit({
          t: 'item',
          item: {
            kind: 'error',
            id: `nobin:${Date.now()}`,
            message: 'The Codex CLI (`codex`) was not found. Install it and sign in.',
          },
        })
        turn.finish(false)
        return
      }
      await active.ensureReady()
      const { approvalPolicy, sandbox } = modeToPolicy(opts.mode)
      const resumeId = typeof opts.resume === 'string' && opts.resume !== '' ? opts.resume : null

      // thread/resume rejoins a running thread OR loads a persisted one; fall back to a
      // fresh thread/start if resume fails (a stale/deleted handle). Both carry the
      // per-thread cwd + mode-derived policy, so a mode change applies on the next turn.
      let threadId: string | null = null
      if (resumeId) {
        try {
          const result = await active.request(
            'thread/resume',
            buildThreadResumeParams({
              threadId: resumeId,
              cwd: opts.repoPath,
              model: opts.model,
              approvalPolicy,
              sandbox,
            }),
          )
          threadId = parseThreadId(result)
        } catch {
          threadId = null
        }
      }
      if (threadId === null) {
        const result = await active.request(
          'thread/start',
          buildThreadStartParams({
            cwd: opts.repoPath,
            model: opts.model,
            approvalPolicy,
            sandbox,
          }),
        )
        threadId = parseThreadId(result)
      }
      if (threadId === null) throw new Error('codex thread/start returned no thread id')

      turn.threadId = threadId
      opts.onSessionState(threadId)
      // Register before turn/start so notifications that race the response are routed.
      active.register(turn)
      if (turn.abortRequested) {
        active.interrupt(turn)
        return
      }

      // The app-server turn takes the input text literally — expanding `/name` is a Codex
      // TUI feature, not something `turn/start` does — so we expand custom prompts driver-
      // side against `~/.codex/prompts`. A non-command message passes through unchanged.
      const promptText = await expandSlashCommand(opts.text, [codexPromptsDir()], false)
      const turnResult = await active.request(
        'turn/start',
        buildTurnStartParams({
          threadId,
          input: buildUserInput(promptText, opts.images),
          effort: opts.options.effort,
          model: opts.model,
          interaction: opts.interaction,
        }),
      )
      turn.turnId = parseTurnId(turnResult)
      if (turn.abortRequested) active.interrupt(turn)
    }

    run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      turn.emit({ t: 'item', item: { kind: 'error', id: `start:${Date.now()}`, message } })
      turn.finish(false)
    })

    return {
      abort() {
        // Swallow the trailing turn/completed: the manager already reset thread state on
        // abort and does NOT expect onDone, so finish must fire zero more callbacks.
        turn.done = true
        turn.abortRequested = true
        if (active && turn.threadId) active.interrupt(turn)
      },
      respondApproval(requestId: string, decision: ApprovalDecision) {
        if (active) active.respondApproval(turn, requestId, decision)
      },
    }
  },
}

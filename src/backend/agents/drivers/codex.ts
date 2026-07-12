import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import type {
  AgentEvent,
  ApprovalDecision,
  ProviderStatus,
  TimelineItem,
} from '../../../shared/agent-protocol'
import { terminalEnv } from '../../terminal-env'
import type { AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import {
  APPROVAL_METHODS,
  buildApprovalItem,
  buildThreadResumeParams,
  buildThreadStartParams,
  buildTurnStartParams,
  buildUserInput,
  encodeMessage,
  type Incoming,
  isLegacyApprovalMethod,
  LineDecoder,
  modeToPolicy,
  parseAccountLabel,
  parseAuthenticated,
  parseIncoming,
  parseModelList,
  parseThreadId,
  parseTurnId,
  type RpcId,
  routingKeys,
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
}

// ── The shared server singleton ────────────────────────────────────────────────────

let server: CodexServer | null = null

function ensureServer(): CodexServer | null {
  if (server) return server
  const env = terminalEnv(process.env)
  const bin = resolveCodexBin(env)
  if (!bin) return null
  server = new CodexServer(bin, env)
  return server
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
    const active = ensureServer()
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

  startTurn(opts: StartTurnOptions): TurnHandle {
    const turn = new CodexTurn(opts)
    const active = ensureServer()

    // The whole handshake is async; startTurn returns synchronously, so every emit here
    // lands after the manager has recorded the returned handle (per StartTurnOptions).
    const run = async (): Promise<void> => {
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

      const turnResult = await active.request(
        'turn/start',
        buildTurnStartParams({
          threadId,
          input: buildUserInput(opts.text, opts.images),
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

import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { ApprovalDecision } from '../../../shared/agent-protocol'
import { agentSpawnEnv } from '../../login-shell-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { listCommandsAndSkills } from './agent-commands-fs'
import { importClaudeSession, listClaudeSessions } from './claude-sessions'
import {
  buildClaudeArgs,
  buildUserMessage,
  CLAUDE_MODELS,
  ClaudeStreamTranslator,
  readClaudeAuthFromJson,
  resolveClaudeBin,
  titleForTool,
} from './claude-stream'

/**
 * Claude Code driver — spawns the user's installed `claude` CLI (v2.1.207+) in
 * stream-json duplex mode and speaks its wire + control protocol. All the translation
 * logic lives in the pure, unit-tested `claude-stream.ts`; this file is the I/O shell.
 *
 * **Process lifetime:** one live CLI process per Claude session when possible. Ending a
 * turn no longer closes stdin / kills the process — Task subagents and background work
 * stay alive while the human keeps chatting. A later turn with the same session id +
 * config fingerprint writes the next user message into the still-open stdin. If the CLI
 * exits after a result (older behavior) we fall back to a fresh `--resume` spawn, same
 * as before. Abort, config change, and thread delete still kill the process.
 *
 * Auth piggybacks the CLI's own login — we never trigger one. NO electron imports (the
 * daemon is Electron-free); every child spawn uses `agentSpawnEnv` so the daemon token
 * and ELECTRON_RUN_AS_NODE never leak into the CLI process.
 */

// The env drives PATH-based resolution: pass the login-PATH-merged agentSpawnEnv at the
// spawn sites so a Homebrew `claude` is found by PATH like a terminal (well-known paths stay
// the fallback); the status probe uses the daemon's own env (well-known covers Homebrew there).
function binLookup(env: NodeJS.ProcessEnv = process.env) {
  return { exists: (path: string) => existsSync(path), env, home: homedir() }
}

// Auto-title: a one-shot `claude -p` haiku call. Capped so a hung CLI can't leak a process
// (execFile's `timeout` SIGTERMs it). The prompt is deliberately strict so the reply is the
// title text itself — `--output-format text` gives us just that, no JSON to parse.
const TITLE_TIMEOUT_MS = 20_000
const titlePrompt = (text: string): string =>
  `Reply with ONLY a 2-5 word title for this coding request, no quotes or punctuation:\n\n${text.slice(0, 2000)}`

// The pending state for one in-flight approval, kept so `respondApproval` can build the
// right allow/deny control_response and re-emit the resolved approval item.
interface PendingApproval {
  toolName: string
  input: Record<string, unknown>
  permissionSuggestions: unknown[]
}

// A driver-private resume handle persisted on the thread. Parsed loosely because it's
// whatever we wrote last turn (or `undefined` on the first turn / a legacy thread).
function resumeSessionId(resume: unknown): string | undefined {
  if (resume && typeof resume === 'object' && 'sessionId' in resume) {
    const value = (resume as { sessionId: unknown }).sessionId
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/** Config that forces a new process when it changes mid-conversation. */
function turnFingerprint(opts: StartTurnOptions): string {
  return JSON.stringify({
    repoPath: opts.repoPath,
    model: opts.model,
    mode: opts.mode,
    interaction: opts.interaction,
    effort: opts.options.effort ?? '',
    contextWindow: opts.options.contextWindow ?? '',
  })
}

// ── Live multi-turn sessions ─────────────────────────────────────────────────

interface TurnState {
  opts: StartTurnOptions
  translator: ClaudeStreamTranslator
  pending: Map<string, PendingApproval>
  finished: boolean
  killTimer: ReturnType<typeof setTimeout> | null
  finish: (ok: boolean) => void
}

interface LiveClaudeSession {
  proc: ChildProcessWithoutNullStreams | null
  fingerprint: string
  sessionId: string | null
  /** Set from the first init; multi-turn reuses don't re-send system init. */
  interruptSupported: boolean
  turn: TurnState | null
  /** First-turn spawn still resolving env — abort before child exists. */
  abortRequested: boolean
  /** Between-turn reclaim timer (cleared when a new turn binds). */
  idleTimer: ReturnType<typeof setTimeout> | null
}

/** Sessions keyed by Claude session id once init has reported it. */
const sessionsById = new Map<string, LiveClaudeSession>()
/** Live sessions still waiting for their first session id (first turn). */
const sessionsPendingId = new Set<LiveClaudeSession>()

/**
 * How long an idle (between-turns) Claude process is kept so Task subagents can finish
 * and the next user message reuses stdin. After this, kill and fall back to `--resume`.
 * Archive never hits the daemon, so without a TTL every one-turn thread would leak a process.
 */
const IDLE_TTL_MS = 10 * 60 * 1000

function dropSession(session: LiveClaudeSession): void {
  sessionsPendingId.delete(session)
  // Identity check: a late exit from an old process must not un-track a newer spawn that
  // re-registered the same session id after abort / fingerprint change.
  if (session.sessionId !== null && sessionsById.get(session.sessionId) === session) {
    sessionsById.delete(session.sessionId)
  }
  if (session.idleTimer !== null) {
    clearTimeout(session.idleTimer)
    session.idleTimer = null
  }
}

function killProcess(session: LiveClaudeSession): void {
  dropSession(session)
  session.abortRequested = true
  const proc = session.proc
  if (!proc) return
  try {
    if (!proc.killed) proc.kill('SIGTERM')
  } catch {
    // already dead
  }
}

function writeStdin(session: LiveClaudeSession, payload: unknown): void {
  const proc = session.proc
  if (proc?.stdin.writable) {
    proc.stdin.write(`${JSON.stringify(payload)}\n`)
  }
}

function writeUserMessage(session: LiveClaudeSession, opts: StartTurnOptions): void {
  const proc = session.proc
  if (proc?.stdin.writable) {
    proc.stdin.write(`${buildUserMessage(opts.text, opts.images)}\n`)
  }
}

function armIdleTimer(session: LiveClaudeSession): void {
  if (session.idleTimer !== null) clearTimeout(session.idleTimer)
  session.idleTimer = setTimeout(() => {
    session.idleTimer = null
    // Only reclaim if still idle — a turn that started later cleared/reset this timer.
    if (session.turn === null) killProcess(session)
  }, IDLE_TTL_MS)
}

function bindTurn(session: LiveClaudeSession, opts: StartTurnOptions): TurnState {
  if (session.idleTimer !== null) {
    clearTimeout(session.idleTimer)
    session.idleTimer = null
  }
  const turn: TurnState = {
    opts,
    translator: new ClaudeStreamTranslator(),
    pending: new Map(),
    finished: false,
    killTimer: null,
    finish: (ok: boolean) => {
      if (turn.finished) return
      turn.finished = true
      if (turn.killTimer) clearTimeout(turn.killTimer)
      // Clear the active turn so the next startTurn can reuse this process.
      if (session.turn === turn) {
        session.turn = null
        // Keep the CLI alive briefly for Task subagents + follow-up chat; then reclaim.
        // Skip if exit/abort already dropSession'd this object (identity-safe maps).
        const stillTracked =
          (session.sessionId !== null && sessionsById.get(session.sessionId) === session) ||
          sessionsPendingId.has(session)
        if (stillTracked) armIdleTimer(session)
      }
      opts.onDone({ ok })
    },
  }
  session.turn = turn
  return turn
}

function emitError(turn: TurnState, message: string): void {
  turn.opts.emit({ t: 'item', item: { kind: 'error', id: randomUUID(), message } })
}

function handleLine(session: LiveClaudeSession, line: string): void {
  const turn = session.turn
  if (!turn || turn.finished) return
  for (const signal of turn.translator.pushLine(line)) {
    switch (signal.t) {
      case 'event':
        turn.opts.emit(signal.event)
        break
      case 'session': {
        // Persist the resumable session id so a cold --resume still works if the process dies.
        turn.opts.onSessionState({ sessionId: signal.sessionId })
        if (session.sessionId === null) {
          session.sessionId = signal.sessionId
          sessionsPendingId.delete(session)
          sessionsById.set(signal.sessionId, session)
        }
        if (turn.translator.interruptSupported) session.interruptSupported = true
        break
      }
      case 'approval-request':
        turn.pending.set(signal.requestId, {
          toolName: signal.toolName,
          input: signal.input,
          permissionSuggestions: signal.permissionSuggestions,
        })
        break
      case 'done':
        // Keep the process alive for the next user message (and any still-running Task
        // subagents). Older CLIs may still exit after result — the exit handler cleans up.
        if (turn.translator.interruptSupported) session.interruptSupported = true
        turn.finish(signal.ok)
        break
    }
  }
  // interruptSupported may flip on system init without a session signal path above.
  if (turn.translator.interruptSupported) session.interruptSupported = true
}

function resolveApproval(
  session: LiveClaudeSession,
  requestId: string,
  decision: ApprovalDecision,
): void {
  const turn = session.turn
  if (!turn) return
  const info = turn.pending.get(requestId)
  if (!info) return
  turn.pending.delete(requestId)
  const { title, detail } = titleForTool(info.toolName, info.input)
  if (decision === 'decline') {
    writeStdin(session, {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        // interrupt:false lets the model react to the denial instead of aborting.
        response: {
          behavior: 'deny',
          message: 'User declined tool execution.',
          interrupt: false,
        },
      },
    })
    turn.opts.emit({
      t: 'item',
      item: {
        kind: 'approval',
        id: `approval:${requestId}`,
        requestId,
        title,
        ...(detail ? { command: detail } : {}),
        status: 'declined',
      },
    })
    return
  }
  // accept / accept-session → allow. accept-session echoes the CLI's own permission
  // suggestions back as updatedPermissions so the grant sticks for the session; a
  // plain accept just allows this one call.
  const allow: Record<string, unknown> = { behavior: 'allow', updatedInput: info.input }
  if (decision === 'accept-session' && info.permissionSuggestions.length > 0) {
    allow.updatedPermissions = info.permissionSuggestions
  }
  writeStdin(session, {
    type: 'control_response',
    response: { subtype: 'success', request_id: requestId, response: allow },
  })
  turn.opts.emit({
    t: 'item',
    item: {
      kind: 'approval',
      id: `approval:${requestId}`,
      requestId,
      title,
      ...(detail ? { command: detail } : {}),
      status: 'accepted',
    },
  })
}

function abortTurn(session: LiveClaudeSession): void {
  const turn = session.turn
  if (turn?.finished) {
    // Idle between turns — still kill so delete/Stop after idle reclaims the process.
    killProcess(session)
    return
  }
  session.abortRequested = true
  if (turn) {
    for (const [requestId, info] of turn.pending) {
      const { title, detail } = titleForTool(info.toolName, info.input)
      turn.opts.emit({
        t: 'item',
        item: {
          kind: 'approval',
          id: `approval:${requestId}`,
          requestId,
          title,
          ...(detail ? { command: detail } : {}),
          status: 'canceled',
        },
      })
    }
    turn.pending.clear()
    turn.opts.emit({ t: 'status', status: 'idle' })
  }
  const proc = session.proc
  if (!proc) {
    // run() will kill the child it spawns; finish the turn now so the manager unblocks.
    turn?.finish(false)
    dropSession(session)
    return
  }
  // Prefer a graceful interrupt when the CLI advertised the capability; otherwise
  // (or if it doesn't exit) fall back to SIGTERM. Either way the process must die —
  // we do not reuse after an interrupt.
  if (session.interruptSupported && proc.stdin.writable && turn) {
    writeStdin(session, {
      type: 'control_request',
      request_id: `int_${randomUUID()}`,
      request: { subtype: 'interrupt' },
    })
    turn.killTimer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGTERM')
    }, 1000)
  } else {
    try {
      if (!proc.killed) proc.kill('SIGTERM')
    } catch {
      // already dead
    }
  }
  dropSession(session)
  turn?.finish(false)
}

function attachProcessHandlers(
  session: LiveClaudeSession,
  proc: ChildProcessWithoutNullStreams,
): void {
  // Attach the error SINKS before any abort path: an EPIPE from a dying CLI (stdin) and
  // an async spawn `'error'` can fire AFTER spawn returns.
  proc.stdin.on('error', () => {})
  proc.on('error', (error) => {
    const turn = session.turn
    if (turn && !turn.finished) {
      emitError(turn, `claude process error: ${error.message}`)
      turn.finish(false)
    }
    dropSession(session)
  })

  const rl = createInterface({ input: proc.stdout })
  rl.on('line', (line) => handleLine(session, line))

  let stderrTail = ''
  proc.stderr.on('data', (chunk: Buffer) => {
    stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2000)
  })

  proc.on('exit', (code) => {
    const turn = session.turn
    dropSession(session)
    // If a result line already finished the turn this is a no-op; otherwise the process
    // died without a result (crash, killed pipe) — surface it and close the turn.
    if (turn && !turn.finished) {
      if (code !== 0) {
        emitError(
          turn,
          `claude exited with code ${code ?? 'null'}${stderrTail ? `: ${stderrTail.trim()}` : ''}`,
        )
      }
      turn.finish(code === 0)
    }
  })
}

function tryReuseSession(opts: StartTurnOptions): TurnHandle | null {
  const resumeId = resumeSessionId(opts.resume)
  if (resumeId === undefined) return null
  const session = sessionsById.get(resumeId)
  if (!session) return null
  if (session.fingerprint !== turnFingerprint(opts)) {
    // Model/mode/effort changed — cannot continue on this process.
    killProcess(session)
    return null
  }
  const proc = session.proc
  if (!proc || proc.killed || !proc.stdin.writable) {
    dropSession(session)
    return null
  }
  if (session.turn !== null && !session.turn.finished) {
    // Manager guarantees one turn per thread; refuse a double start on a live process.
    return null
  }
  bindTurn(session, opts)
  // Next user message on the still-open duplex stdin — Task subagents keep running.
  writeUserMessage(session, opts)
  return {
    respondApproval: (requestId, decision) => resolveApproval(session, requestId, decision),
    abort: () => abortTurn(session),
  }
}

function spawnSession(opts: StartTurnOptions): TurnHandle {
  // proc is null until spawn returns; abort before that sets abortRequested so run() kills it.
  const session: LiveClaudeSession = {
    proc: null,
    fingerprint: turnFingerprint(opts),
    sessionId: resumeSessionId(opts.resume) ?? null,
    interruptSupported: false,
    turn: null,
    abortRequested: false,
    idleTimer: null,
  }
  const turn = bindTurn(session, opts)
  if (session.sessionId !== null) sessionsById.set(session.sessionId, session)
  else sessionsPendingId.add(session)

  const run = async (): Promise<void> => {
    const env = await agentSpawnEnv()
    const bin = resolveClaudeBin(binLookup(env))
    if (bin === null) {
      emitError(turn, 'The `claude` CLI was not found. Install it or set PORCELAIN_CLAUDE_BIN.')
      turn.finish(false)
      dropSession(session)
      return
    }
    const args = buildClaudeArgs({
      model: opts.model,
      mode: opts.mode,
      interaction: opts.interaction,
      resumeId: resumeSessionId(opts.resume),
      options: opts.options,
    })

    let proc: ChildProcessWithoutNullStreams
    try {
      proc = spawn(bin, args, {
        cwd: opts.repoPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      emitError(turn, `Failed to start claude: ${String(error)}`)
      turn.finish(false)
      dropSession(session)
      return
    }
    session.proc = proc
    attachProcessHandlers(session, proc)

    if (session.abortRequested) {
      proc.kill('SIGTERM')
      turn.finish(false)
      dropSession(session)
      return
    }

    // First user message; stdin stays open across turns for multi-turn + subagents.
    writeUserMessage(session, opts)
  }

  run().catch((error: unknown) => {
    emitError(turn, `Failed to start claude: ${String(error)}`)
    turn.finish(false)
    dropSession(session)
  })

  return {
    respondApproval: (requestId, decision) => resolveApproval(session, requestId, decision),
    abort: () => abortTurn(session),
  }
}

/**
 * Kill a live Claude process for a thread's session (idle between turns or mid-turn).
 * Called when the thread is deleted so Task subagents and the CLI don't leak.
 */
export function releaseClaudeSession(resume: unknown): void {
  const id = resumeSessionId(resume)
  if (id === undefined) return
  const session = sessionsById.get(id)
  if (session) killProcess(session)
}

/** Kill every live Claude process — daemon shutdown / tests. */
export function releaseAllClaudeSessions(): void {
  for (const session of [...sessionsById.values()]) killProcess(session)
  for (const session of [...sessionsPendingId]) killProcess(session)
}

export const claudeDriver: AgentDriver = {
  provider: 'claude',

  async status() {
    const bin = resolveClaudeBin(binLookup())
    let auth: { authenticated: boolean; account?: string } = { authenticated: false }
    try {
      // `~/.claude.json` read — the cheapest reliable auth signal, and it never starts a
      // login. Absent/corrupt file → unauthenticated, not an error.
      auth = readClaudeAuthFromJson(readFileSync(`${homedir()}/.claude.json`, 'utf8'))
    } catch {
      // no config file yet — reported as not authenticated below
    }
    return {
      provider: 'claude',
      installed: bin !== null,
      authenticated: auth.authenticated,
      ...(auth.account ? { account: auth.account } : {}),
      models: CLAUDE_MODELS,
    }
  },

  // Claude's slash invocations are custom commands (`.claude/commands/**.md`, repo-local then
  // user-global; nested dirs namespace with `:`, so the scan is recursive) AND skills
  // (`.claude/skills/<name>/SKILL.md`) — modern Claude Code exposes each skill as `/<name>`.
  // The CLI natively expands both in `-p` stream-json mode, so startTurn sends the user's text
  // through untouched (no expandSlashCommand here, unlike Codex/OpenCode).
  listCommands(repoPath: string): Promise<AgentCommand[]> {
    return listCommandsAndSkills(
      [join(repoPath, '.claude', 'commands'), join(homedir(), '.claude', 'commands')],
      [join(repoPath, '.claude', 'skills'), join(homedir(), '.claude', 'skills')],
    )
  },

  listRecentSessions(repoPath: string, limit?: number) {
    return listClaudeSessions(repoPath, limit)
  },

  importSession(repoPath: string, externalId: string) {
    return importClaudeSession(repoPath, externalId)
  },

  // A cheap one-shot title via `claude -p … --model haiku --bare`. `--bare` is load-bearing:
  // without it the title call cold-starts a FULL project session (CLAUDE.md, skills, MCP,
  // hooks) just to mint a 2–5 word name — the single biggest agent-tab-only token waste vs
  // the terminal. Bare skips that; any failure (no binary, older CLI without --bare, auth,
  // timeout, empty output) resolves null so the manager keeps the derived first-line title.
  async generateTitle({
    repoPath,
    text,
  }: {
    repoPath: string
    text: string
  }): Promise<string | null> {
    const env = await agentSpawnEnv()
    const bin = resolveClaudeBin(binLookup(env))
    if (bin === null) return null
    return new Promise((resolve) => {
      execFile(
        bin,
        ['-p', titlePrompt(text), '--model', 'haiku', '--output-format', 'text', '--bare'],
        { cwd: repoPath, env, timeout: TITLE_TIMEOUT_MS },
        (error, stdout) => {
          if (error) {
            resolve(null)
            return
          }
          const title = stdout.trim()
          resolve(title === '' ? null : title)
        },
      )
    })
  },

  startTurn(opts: StartTurnOptions): TurnHandle {
    // Prefer a still-open process for this session so Task subagents survive the chat.
    const reused = tryReuseSession(opts)
    if (reused) return reused
    return spawnSession(opts)
  },
}

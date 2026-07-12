import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import type { ApprovalDecision, ProviderLimits } from '../../../shared/agent-protocol'
import { terminalEnv } from '../../terminal-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { listCommandFiles } from './agent-commands-fs'
import {
  buildClaudeArgs,
  buildUserMessage,
  CLAUDE_MODELS,
  ClaudeStreamTranslator,
  mapClaudeUsage,
  parseClaudeOAuthToken,
  readClaudeAuthFromJson,
  resolveClaudeBin,
  titleForTool,
} from './claude-stream'

const execFileAsync = promisify(execFile)

// The Claude subscription OAuth token's two storage locations + the endpoint the CLI's
// `/usage` view reads. The token is a subscription auth secret: it leaves the daemon ONLY
// in the Authorization header to exactly this host, and is never logged, cached, or put in
// an error/event (see the audit skill's agent-driver invariant).
const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials'
const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const CLAUDE_LIMITS_TIMEOUT_MS = 5_000

/**
 * Read the stored Claude OAuth access token: the macOS Keychain first (may prompt once —
 * acceptable, `limits()` is lazy), then `~/.claude/.credentials.json` (Linux / standalone
 * daemon). Returns null (never throws, never logs the token) when neither yields one — an
 * API-key user has no such credential, which is how they're skipped.
 */
async function readClaudeOAuthToken(): Promise<string | null> {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync(
        'security',
        ['find-generic-password', '-s', CLAUDE_KEYCHAIN_SERVICE, '-w'],
        { env: terminalEnv(process.env) },
      )
      const token = parseClaudeOAuthToken(stdout)
      if (token !== null) return token
    } catch {
      // No Keychain entry, or the user denied access — fall through to the file.
    }
  }
  try {
    const raw = await readFile(join(homedir(), '.claude', '.credentials.json'), 'utf8')
    return parseClaudeOAuthToken(raw)
  } catch {
    return null
  }
}

/**
 * Claude Code driver — spawns the user's installed `claude` CLI (v2.1.207+) once per
 * turn in stream-json duplex mode and speaks its wire + control protocol. All the
 * translation logic lives in the pure, unit-tested `claude-stream.ts`; this file is the
 * I/O shell: resolve the binary, spawn with a scrubbed env, pump stdout through the
 * translator, and answer control requests (approvals, interrupt) on stdin.
 *
 * Auth piggybacks the CLI's own login — we never trigger one. NO electron imports (the
 * daemon is Electron-free); every child spawn uses `terminalEnv` so the daemon token and
 * ELECTRON_RUN_AS_NODE never leak into the CLI process.
 */

function binLookup() {
  return { exists: (path: string) => existsSync(path), env: process.env, home: homedir() }
}

// Auto-title: a one-shot `claude -p` haiku call. Capped so a hung CLI can't leak a process
// (execFile's `timeout` SIGTERMs it). The prompt is deliberately strict so the reply is the
// title text itself — `--output-format text` gives us just that, no JSON to parse.
const TITLE_TIMEOUT_MS = 20_000
const titlePrompt = (text: string): string =>
  `Reply with ONLY a 3-8 word title for this coding request, no quotes or punctuation:\n\n${text.slice(0, 2000)}`

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

  // Claude's quota windows aren't on the headless stream, so we replicate the CLI's own
  // `GET /api/oauth/usage` with the stored subscription OAuth token (Keychain → file). Only
  // subscription (claude.ai) auth has such a token AND populated windows; an API-key user
  // has neither, so this returns null and the group hides. Any failure (no token, timeout,
  // non-200, bad JSON) degrades to null quietly — never surfacing the token. Wrapped in a
  // ~5s timeout so a hung request can't stall the poll.
  async limits(): Promise<ProviderLimits | null> {
    const token = await readClaudeOAuthToken()
    if (token === null) return null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CLAUDE_LIMITS_TIMEOUT_MS)
    try {
      const response = await fetch(CLAUDE_USAGE_URL, {
        headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20' },
        signal: controller.signal,
      })
      if (!response.ok) return null
      return mapClaudeUsage(await response.json())
    } catch {
      // Network error / abort / malformed body — degrade to null. The token is confined to
      // this scope and never appears in what we return or throw.
      return null
    } finally {
      clearTimeout(timer)
    }
  },

  // Custom slash commands live in `.md` files, repo-local then user-global; nested dirs
  // namespace with `:` (Claude's own convention), so the scan is recursive.
  listCommands(repoPath: string): Promise<AgentCommand[]> {
    return listCommandFiles(
      [join(repoPath, '.claude', 'commands'), join(homedir(), '.claude', 'commands')],
      true,
    )
  },

  // A cheap one-shot title via `claude -p … --model haiku`. Resolves null on any failure
  // (no binary, non-zero exit, timeout, empty output) so the manager keeps the derived
  // title. The turn itself never expands `/name` here because the CLI does that natively
  // (verified: `-p` stream-json mode expands custom slash commands), so startTurn passes
  // the user's text through untouched.
  generateTitle({ repoPath, text }: { repoPath: string; text: string }): Promise<string | null> {
    const bin = resolveClaudeBin(binLookup())
    if (bin === null) return Promise.resolve(null)
    return new Promise((resolve) => {
      execFile(
        bin,
        ['-p', titlePrompt(text), '--model', 'haiku', '--output-format', 'text'],
        { cwd: repoPath, env: terminalEnv(process.env), timeout: TITLE_TIMEOUT_MS },
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
    const bin = resolveClaudeBin(binLookup())
    if (bin === null) {
      // No CLI — fail the turn cleanly and asynchronously (the manager records the handle
      // before onDone; see StartTurnOptions.emit).
      queueMicrotask(() => {
        opts.emit({
          t: 'item',
          item: {
            kind: 'error',
            id: randomUUID(),
            message: 'The `claude` CLI was not found. Install it or set PORCELAIN_CLAUDE_BIN.',
          },
        })
        opts.onDone({ ok: false })
      })
      return { abort() {}, respondApproval() {} }
    }

    const args = buildClaudeArgs({
      model: opts.model,
      mode: opts.mode,
      interaction: opts.interaction,
      resumeId: resumeSessionId(opts.resume),
      options: opts.options,
    })

    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(bin, args, {
        cwd: opts.repoPath,
        // SCRUBBED env: no daemon token / ELECTRON_RUN_AS_NODE reaches the CLI.
        env: terminalEnv(process.env),
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      queueMicrotask(() => {
        opts.emit({
          t: 'item',
          item: {
            kind: 'error',
            id: randomUUID(),
            message: `Failed to start claude: ${String(error)}`,
          },
        })
        opts.onDone({ ok: false })
      })
      return { abort() {}, respondApproval() {} }
    }

    // An EPIPE from a dying CLI must not crash the daemon with an unhandled 'error' — same
    // precedent as session.ts's socket error listener ('close'/'exit' follows and drives the
    // real teardown; this listener just absorbs the write error).
    child.stdin.on('error', () => {})

    const translator = new ClaudeStreamTranslator()
    const pending = new Map<string, PendingApproval>()
    let finished = false
    let killTimer: ReturnType<typeof setTimeout> | null = null

    // onDone fires EXACTLY once, whatever ends the turn (result line, exit, spawn error,
    // or abort). Guarded so a result immediately followed by exit can't double-report.
    const finish = (ok: boolean): void => {
      if (finished) return
      finished = true
      if (killTimer) clearTimeout(killTimer)
      opts.onDone({ ok })
    }

    const emitError = (message: string): void => {
      opts.emit({ t: 'item', item: { kind: 'error', id: randomUUID(), message } })
    }

    // Answer a control_request on stdin. Best-effort: if the pipe is already closed the
    // turn is ending anyway.
    const writeStdin = (payload: unknown): void => {
      if (child.stdin.writable) child.stdin.write(`${JSON.stringify(payload)}\n`)
    }

    const rl = createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      for (const signal of translator.pushLine(line)) {
        switch (signal.t) {
          case 'event':
            opts.emit(signal.event)
            break
          case 'session':
            // Persist the resumable session id so the next turn continues the conversation.
            opts.onSessionState({ sessionId: signal.sessionId })
            break
          case 'approval-request':
            pending.set(signal.requestId, {
              toolName: signal.toolName,
              input: signal.input,
              permissionSuggestions: signal.permissionSuggestions,
            })
            break
          case 'done':
            // The turn completed; close stdin so the (duplex) process exits.
            if (child.stdin.writable) child.stdin.end()
            finish(signal.ok)
            break
        }
      }
    })

    // stderr is human diagnostics, never protocol — drain it so the pipe can't fill and
    // stall the child, keeping only the tail for an error message on a bad exit.
    let stderrTail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2000)
    })

    child.on('error', (error) => {
      emitError(`claude process error: ${error.message}`)
      finish(false)
    })
    child.on('exit', (code) => {
      // If a result line already finished the turn this is a no-op; otherwise the process
      // died without a result (crash, killed pipe) — surface it and close the turn.
      if (!finished) {
        if (code !== 0)
          emitError(
            `claude exited with code ${code ?? 'null'}${stderrTail ? `: ${stderrTail.trim()}` : ''}`,
          )
        finish(code === 0)
      }
    })

    // Send the user's message (with any images) as the turn's first stdin line. stdin
    // stays open so we can answer approvals / send an interrupt mid-turn.
    child.stdin.write(`${buildUserMessage(opts.text, opts.images)}\n`)

    const resolveApproval = (requestId: string, decision: ApprovalDecision): void => {
      const info = pending.get(requestId)
      if (!info) return
      pending.delete(requestId)
      const { title, detail } = titleForTool(info.toolName, info.input)
      if (decision === 'decline') {
        writeStdin({
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
        opts.emit({
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
      writeStdin({
        type: 'control_response',
        response: { subtype: 'success', request_id: requestId, response: allow },
      })
      opts.emit({
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

    return {
      respondApproval: resolveApproval,
      abort() {
        if (finished) return
        // Cancel any approvals the human never answered, so they don't linger pending.
        for (const [requestId, info] of pending) {
          const { title, detail } = titleForTool(info.toolName, info.input)
          opts.emit({
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
        pending.clear()
        opts.emit({ t: 'status', status: 'idle' })
        // Prefer a graceful interrupt when the CLI advertised the capability; otherwise
        // (or if it doesn't exit) fall back to SIGTERM.
        if (translator.interruptSupported && child.stdin.writable) {
          writeStdin({
            type: 'control_request',
            request_id: `int_${randomUUID()}`,
            request: { subtype: 'interrupt' },
          })
          killTimer = setTimeout(() => {
            if (!child.killed) child.kill('SIGTERM')
          }, 1000)
        } else {
          child.kill('SIGTERM')
        }
        finish(false)
      },
    }
  },
}

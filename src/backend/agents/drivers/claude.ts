import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { promisify } from 'node:util'
import type { ApprovalDecision, ProviderLimits } from '../../../shared/agent-protocol'
import { agentSpawnEnv } from '../../login-shell-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { listCommandsAndSkills } from './agent-commands-fs'
import { importClaudeSession, listClaudeSessions } from './claude-sessions'
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
import { codexbarLimits, resolveCodexbarBin } from './codexbar'

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
        { env: await agentSpawnEnv() },
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
 * daemon is Electron-free); every child spawn uses `agentSpawnEnv` (the scrubbed env with
 * the login-shell PATH merged in) so the daemon token and ELECTRON_RUN_AS_NODE never leak
 * into the CLI process, and its `npx`/`node`-style MCP servers resolve like in a terminal.
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
    // Prefer the user-installed codexbar CLI when present: it reads Claude's quota through its
    // own sources more reliably than our Keychain probe, AND the subscription OAuth token never
    // enters Porcelain on that path (codexbar holds its own auth). Fall through to the native
    // probe below when codexbar isn't installed or returns nothing.
    const codexbarBin = resolveCodexbarBin(binLookup())
    if (codexbarBin !== null) {
      const limits = await codexbarLimits('claude', codexbarBin)
      if (limits !== null) return limits
    }
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

  // A cheap one-shot title via `claude -p … --model haiku`. Resolves null on any failure
  // (no binary, non-zero exit, timeout, empty output) so the manager keeps the derived
  // title. The turn itself never expands `/name` here because the CLI does that natively
  // (verified: `-p` stream-json mode expands custom slash commands), so startTurn passes
  // the user's text through untouched.
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
        ['-p', titlePrompt(text), '--model', 'haiku', '--output-format', 'text'],
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
    // The spawn is deferred into run() because resolving the login-shell PATH (agentSpawnEnv)
    // is async; startTurn still returns its handle synchronously (the manager records it
    // before any callback fires). `child` is therefore null until run() spawns it — the
    // handle guards on that, and an abort during the window sets `abortRequested` so run()
    // tears the fresh child down.
    let child: ChildProcessWithoutNullStreams | null = null
    const translator = new ClaudeStreamTranslator()
    const pending = new Map<string, PendingApproval>()
    let finished = false
    let killTimer: ReturnType<typeof setTimeout> | null = null
    let abortRequested = false

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

    // Answer a control_request on stdin. Best-effort: if the pipe is already closed (or the
    // child isn't spawned yet) the turn is ending anyway.
    const writeStdin = (payload: unknown): void => {
      if (child?.stdin.writable) child.stdin.write(`${JSON.stringify(payload)}\n`)
    }

    const run = async (): Promise<void> => {
      // Login-PATH-merged scrubbed env (login-shell-env.ts): the daemon token /
      // ELECTRON_RUN_AS_NODE never reach the CLI, and its `npx`/`node`-style MCP servers
      // resolve under a Dock-launched daemon's minimal PATH. The binary resolves from that
      // same PATH (well-known paths stay the fallback).
      const env = await agentSpawnEnv()
      const bin = resolveClaudeBin(binLookup(env))
      if (bin === null) {
        emitError('The `claude` CLI was not found. Install it or set PORCELAIN_CLAUDE_BIN.')
        finish(false)
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
        emitError(`Failed to start claude: ${String(error)}`)
        finish(false)
        return
      }
      child = proc
      // Attach the error SINKS before the abort-early-return below: an EPIPE from a dying CLI
      // (stdin) and — crucially — an async spawn `'error'` (EACCES on a non-exec resolved path,
      // EMFILE) can fire AFTER spawn returns, so a child we kill immediately on abort still
      // needs an 'error' listener or Node crashes the daemon with an unhandled event. Same
      // precedent as session.ts's socket error listener ('exit' drives the real teardown).
      proc.stdin.on('error', () => {})
      proc.on('error', (error) => {
        if (!finished) emitError(`claude process error: ${error.message}`)
        finish(false)
      })

      // Aborted while we resolved the env / spawned — tear the fresh child down at once.
      if (abortRequested) {
        proc.kill('SIGTERM')
        finish(false)
        return
      }

      const rl = createInterface({ input: proc.stdout })
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
              if (proc.stdin.writable) proc.stdin.end()
              finish(signal.ok)
              break
          }
        }
      })

      // stderr is human diagnostics, never protocol — drain it so the pipe can't fill and
      // stall the child, keeping only the tail for an error message on a bad exit.
      let stderrTail = ''
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2000)
      })

      proc.on('exit', (code) => {
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
      proc.stdin.write(`${buildUserMessage(opts.text, opts.images)}\n`)
    }

    // startTurn returns synchronously; the whole spawn runs here. A spawn-path throw ends
    // the turn cleanly (the manager has already recorded the handle).
    run().catch((error: unknown) => {
      emitError(`Failed to start claude: ${String(error)}`)
      finish(false)
    })

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
        // Record the abort so a spawn still in flight (run() awaiting the env) tears its
        // fresh child down the moment it appears.
        abortRequested = true
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
        // No child yet (spawn still pending): finish now; run() will kill the child it spawns.
        const proc = child
        if (proc === null) {
          finish(false)
          return
        }
        // Prefer a graceful interrupt when the CLI advertised the capability; otherwise
        // (or if it doesn't exit) fall back to SIGTERM.
        if (translator.interruptSupported && proc.stdin.writable) {
          writeStdin({
            type: 'control_request',
            request_id: `int_${randomUUID()}`,
            request: { subtype: 'interrupt' },
          })
          killTimer = setTimeout(() => {
            if (!proc.killed) proc.kill('SIGTERM')
          }, 1000)
        } else {
          proc.kill('SIGTERM')
        }
        finish(false)
      },
    }
  },
}

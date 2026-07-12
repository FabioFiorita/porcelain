import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import type { ApprovalDecision } from '../../../shared/agent-protocol'
import { terminalEnv } from '../../terminal-env'
import type { AgentDriver, StartTurnOptions, TurnHandle } from '../types'
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

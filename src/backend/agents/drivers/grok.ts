import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { agentSpawnEnv } from '../../login-shell-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { listCommandsAndSkills } from './agent-commands-fs'
import { importGrokSession, listGrokSessions } from './grok-sessions'
import {
  buildGrokArgs,
  GROK_MODELS,
  GrokStreamTranslator,
  readGrokAuth,
  resolveGrokBin,
} from './grok-stream'

/**
 * Grok Build CLI driver — spawns the user's installed `grok` once per turn in headless
 * `--output-format streaming-json` mode. Auth piggybacks the CLI's own login (`grok login`
 * / `XAI_API_KEY`); we never trigger one. Translation lives in pure `grok-stream.ts`.
 *
 * Unlike Claude/Codex, Grok's headless stream has no interactive approval channel and no
 * tool-event projection — tools run inside the CLI under `--permission-mode`, and the
 * timeline only shows reasoning + assistant text. `respondApproval` is therefore a no-op.
 */

function binLookup(env: NodeJS.ProcessEnv = process.env) {
  return { exists: (path: string) => existsSync(path), env, home: homedir() }
}

function resumeSessionId(resume: unknown): string | undefined {
  if (resume && typeof resume === 'object' && 'sessionId' in resume) {
    const value = (resume as { sessionId: unknown }).sessionId
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

const TITLE_TIMEOUT_MS = 20_000
const titlePrompt = (text: string): string =>
  `Reply with ONLY a 2-5 word title for this coding request, no quotes or punctuation:\n\n${text.slice(0, 2000)}`

export const grokDriver: AgentDriver = {
  provider: 'grok',

  async status() {
    const bin = resolveGrokBin(binLookup())
    let authJson: string | null = null
    try {
      authJson = readFileSync(join(homedir(), '.grok', 'auth.json'), 'utf8')
    } catch {
      // no auth file yet
    }
    const auth = readGrokAuth({ authJson, env: process.env })
    return {
      provider: 'grok',
      installed: bin !== null,
      authenticated: auth.authenticated,
      ...(auth.account ? { account: auth.account } : {}),
      models: GROK_MODELS,
    }
  },

  // Grok's slash surface is skills (`.agents/skills` + `~/.grok/skills` / project skills)
  // and any user command md under those trees. No separate commands dir like Claude.
  listCommands(repoPath: string): Promise<AgentCommand[]> {
    return listCommandsAndSkills(
      [],
      [
        join(repoPath, '.agents', 'skills'),
        join(repoPath, '.grok', 'skills'),
        join(homedir(), '.grok', 'skills'),
        join(homedir(), '.agents', 'skills'),
      ],
    )
  },

  listRecentSessions(repoPath: string, limit?: number) {
    return listGrokSessions(repoPath, limit)
  },

  importSession(repoPath: string, externalId: string) {
    return importGrokSession(repoPath, externalId)
  },

  async generateTitle({
    repoPath,
    text,
  }: {
    repoPath: string
    text: string
  }): Promise<string | null> {
    const env = await agentSpawnEnv()
    const bin = resolveGrokBin(binLookup(env))
    if (bin === null) return null
    return new Promise((resolve) => {
      execFile(
        bin,
        [
          '-p',
          titlePrompt(text),
          '--model',
          'grok-composer-2.5-fast',
          '--output-format',
          'plain',
          '--permission-mode',
          'bypassPermissions',
          '--no-auto-update',
        ],
        { cwd: repoPath, env, timeout: TITLE_TIMEOUT_MS },
        (error, stdout) => {
          if (error) {
            resolve(null)
            return
          }
          const title = stdout.trim().split('\n').at(-1)?.trim() ?? ''
          resolve(title === '' ? null : title)
        },
      )
    })
  },

  startTurn(opts: StartTurnOptions): TurnHandle {
    let child: ChildProcess | null = null
    const translator = new GrokStreamTranslator()
    let finished = false
    let killTimer: ReturnType<typeof setTimeout> | null = null
    let abortRequested = false

    const finish = (ok: boolean): void => {
      if (finished) return
      finished = true
      if (killTimer) clearTimeout(killTimer)
      opts.onDone({ ok })
    }

    const emitError = (message: string): void => {
      opts.emit({ t: 'item', item: { kind: 'error', id: randomUUID(), message } })
    }

    const run = async (): Promise<void> => {
      const env = await agentSpawnEnv()
      const bin = resolveGrokBin(binLookup(env))
      if (bin === null) {
        emitError('The `grok` CLI was not found. Install it or set PORCELAIN_GROK_BIN.')
        finish(false)
        return
      }

      // Images: Grok headless has no documented image content-block path we can trust
      // across versions. Surface a soft note and still send the text so the turn runs.
      let prompt = opts.text
      if (opts.images.length > 0) {
        prompt = `${opts.text}\n\n[${opts.images.length} image(s) attached — the Grok headless driver cannot forward images yet.]`
      }

      const args = buildGrokArgs({
        prompt,
        model: opts.model,
        mode: opts.mode,
        interaction: opts.interaction,
        resumeId: resumeSessionId(opts.resume),
        options: opts.options,
      })

      let proc: ChildProcess
      try {
        // stdin ignored: headless `-p` takes the prompt on argv (no duplex control channel).
        proc = spawn(bin, args, {
          cwd: opts.repoPath,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        emitError(`Failed to start grok: ${String(error)}`)
        finish(false)
        return
      }
      child = proc
      proc.on('error', (error) => {
        if (!finished) emitError(`grok process error: ${error.message}`)
        finish(false)
      })

      if (abortRequested) {
        proc.kill('SIGTERM')
        finish(false)
        return
      }

      if (!proc.stdout || !proc.stderr) {
        emitError('Failed to start grok: missing stdio pipes')
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
              opts.onSessionState({ sessionId: signal.sessionId })
              break
            case 'done':
              finish(signal.ok)
              break
          }
        }
      })

      let stderrTail = ''
      proc.stderr.on('data', (chunk: Buffer) => {
        stderrTail = `${stderrTail}${chunk.toString()}`.slice(-2000)
      })

      proc.on('exit', (code) => {
        if (!finished) {
          if (code !== 0 && code !== null) {
            emitError(`grok exited with code ${code}${stderrTail ? `: ${stderrTail.trim()}` : ''}`)
          }
          finish(code === 0)
        }
      })
    }

    run().catch((error: unknown) => {
      emitError(`Failed to start grok: ${String(error)}`)
      finish(false)
    })

    return {
      abort() {
        abortRequested = true
        if (child && !child.killed) {
          child.kill('SIGTERM')
          // Escalate if the CLI ignores SIGTERM (long tool call).
          killTimer = setTimeout(() => {
            if (child && !child.killed) child.kill('SIGKILL')
          }, 3_000)
        }
        if (!finished) finish(false)
      },
      // Headless streaming-json has no control channel for approvals.
      respondApproval() {},
    }
  },
}

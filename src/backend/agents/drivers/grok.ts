import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import type { AgentImage } from '../../../shared/agent-protocol'
import { agentSpawnEnv } from '../../login-shell-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { listCommandsAndSkills } from './agent-commands-fs'
import { importGrokSession, listGrokSessions } from './grok-sessions'
import {
  buildGrokArgs,
  buildGrokTextAndImages,
  GROK_MODELS,
  type GrokContentBlock,
  GrokStreamTranslator,
  readGrokAuth,
  resolveGrokBin,
} from './grok-stream'

/** Prefer temp files + resource_link once inline base64 would risk ARG_MAX (~2MB on Linux). */
const INLINE_IMAGE_BUDGET = 1_000_000

function extForMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'png'
}

/**
 * Build the `--prompt-json` payload for a turn with images. Small payloads stay inline
 * (`type: image` + base64); larger ones write temp files on the daemon host and use
 * `resource_link` so argv never hits ARG_MAX. Returns a cleanup that unlinks any temps
 * (best-effort — call after the CLI exits).
 */
export function prepareGrokImagePrompt(
  text: string,
  images: AgentImage[],
): { promptJson: string; cleanup: () => void } {
  if (images.length === 0) {
    return { promptJson: JSON.stringify(buildGrokTextAndImages(text, [])), cleanup: () => {} }
  }
  const total = images.reduce((n, image) => n + image.base64.length, 0)
  if (total <= INLINE_IMAGE_BUDGET) {
    return {
      promptJson: JSON.stringify(buildGrokTextAndImages(text, images)),
      cleanup: () => {},
    }
  }
  const paths: string[] = []
  const blocks: GrokContentBlock[] = [{ type: 'text', text }]
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    if (image === undefined) continue
    const ext = extForMime(image.mediaType)
    const path = join(tmpdir(), `porcelain-grok-img-${randomUUID()}.${ext}`)
    writeFileSync(path, Buffer.from(image.base64, 'base64'))
    paths.push(path)
    blocks.push({
      type: 'resource_link',
      uri: pathToFileURL(path).href,
      name: `image-${i + 1}.${ext}`,
      mimeType: image.mediaType,
    })
  }
  return {
    promptJson: JSON.stringify(blocks),
    cleanup: () => {
      for (const path of paths) {
        try {
          unlinkSync(path)
        } catch {
          // best-effort — temp dir will reclaim eventually
        }
      }
    },
  }
}

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

  // A cheap one-shot title via `grok -p` on the fast/cheap composer model. Grok has no
  // `--bare`-style project-doc skip, so the analog of Claude's `--bare` is running in a
  // neutral tmp cwd instead of the repo: that keeps AGENTS.md / project skills from
  // cold-loading just to mint a 2-5 word name (the biggest agent-tab-only waste vs the
  // terminal) — the prompt already carries the user's message. Resolves null on any
  // failure so the manager keeps the derived title.
  async generateTitle({ text }: { repoPath: string; text: string }): Promise<string | null> {
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
        { cwd: tmpdir(), env, timeout: TITLE_TIMEOUT_MS },
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
    // Per-turn key so assistant/reasoning item ids never collide with a prior turn
    // (the reducer upserts by id — a fixed id rewrote earlier replies).
    const translator = new GrokStreamTranslator(randomUUID())
    let finished = false
    let killTimer: ReturnType<typeof setTimeout> | null = null
    let abortRequested = false

    const finish = (ok: boolean): void => {
      if (finished) return
      finished = true
      if (killTimer) clearTimeout(killTimer)
      opts.onDone({ ok })
    }

    /** Emit any still-open streaming items, then end the turn (exit without a clean `end`). */
    const finalizeAndFinish = (ok: boolean): void => {
      if (finished) return
      for (const signal of translator.finalize()) {
        if (signal.t === 'event') opts.emit(signal.event)
      }
      finish(ok)
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

      // Images ride `--prompt-json` (ACP content blocks). Small set stays inline base64;
      // large set writes temp files + resource_link (remote-daemon safe — base64 already
      // crossed the WS; files live on the daemon host next to the CLI).
      let promptJson: string | undefined
      let cleanupImages = (): void => {}
      if (opts.images.length > 0) {
        const prepared = prepareGrokImagePrompt(opts.text, opts.images)
        promptJson = prepared.promptJson
        cleanupImages = prepared.cleanup
      }

      // Session continuity trap (2026-07-20): streaming-json only emits `sessionId` on the
      // final `end` line. Stop/abort kills the process before `end`, so without a pre-minted
      // id `thread.sessionState` stays empty and the next turn (e.g. "here are the images")
      // spawns a cold CLI with no prior messages — the agent "doesn't know what was going on."
      // Mint a UUID for the first turn, pass `--session-id`, and persist it immediately so
      // abort still leaves a resumable Grok conversation (verified: abort mid-stream +
      // `--resume <id>` retains the aborted user prompt).
      const resumeId = resumeSessionId(opts.resume)
      const newSessionId = resumeId === undefined ? randomUUID() : undefined
      if (newSessionId !== undefined) {
        opts.onSessionState({ sessionId: newSessionId })
      }

      const args = buildGrokArgs({
        prompt: opts.text,
        ...(promptJson !== undefined ? { promptJson } : {}),
        model: opts.model,
        mode: opts.mode,
        interaction: opts.interaction,
        ...(resumeId !== undefined ? { resumeId } : {}),
        ...(newSessionId !== undefined ? { newSessionId } : {}),
        options: opts.options,
      })

      let proc: ChildProcess
      try {
        // stdin ignored: headless takes the prompt on argv (`-p` or `--prompt-json`).
        proc = spawn(bin, args, {
          cwd: opts.repoPath,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        cleanupImages()
        emitError(`Failed to start grok: ${String(error)}`)
        finish(false)
        return
      }
      child = proc
      // Drop temp image files once the CLI exits (success, error, or abort).
      proc.on('exit', () => {
        cleanupImages()
      })
      proc.on('error', (error) => {
        if (finished) return
        emitError(`grok process error: ${error.message}`)
        finalizeAndFinish(false)
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
        if (finished) return
        // No `end` line: still close any open streaming bubble so the UI doesn't
        // stay on "Thinking…" / a blinking caret forever after the process dies.
        if (code !== 0 && code !== null) {
          emitError(`grok exited with code ${code}${stderrTail ? `: ${stderrTail.trim()}` : ''}`)
          finalizeAndFinish(false)
          return
        }
        finalizeAndFinish(true)
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
        if (!finished) finalizeAndFinish(false)
      },
      // Headless streaming-json has no control channel for approvals.
      respondApproval() {},
    }
  },
}

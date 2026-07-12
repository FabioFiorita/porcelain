import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { accessSync, constants } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type {
  AgentImage,
  ModelInfo,
  ProviderLimits,
  ProviderStatus,
} from '../../../shared/agent-protocol'
import { terminalEnv } from '../../terminal-env'
import type { AgentCommand, AgentDriver, StartTurnOptions, TurnHandle } from '../types'
import { expandSlashCommand, listCommandFiles } from './agent-commands-fs'
import {
  mapProvidersConfig,
  parseAuthProviders,
  parseModelsCli,
  splitModelId,
} from './opencode-catalog'
import {
  createOpencodeTranslator,
  drainSseLines,
  type OpencodePermissionResponse,
  permissionResponseFor,
} from './opencode-translate'

/**
 * OpenCode driver — drives the user's installed `opencode` (1.17.18) by spawning
 * `opencode serve` and speaking its HTTP + SSE API over plain `fetch` (no SDK dep). All
 * event translation lives in the pure sibling `opencode-translate.ts`; catalog/auth parsing
 * in `opencode-catalog.ts`. This file owns only the impure edges: binary resolution, the
 * one-server-per-repo lifecycle, and the request/stream plumbing.
 *
 * Wire protocol: scratchpad/protocol-opencode.md. Sessions are project-scoped (a server is
 * spawned in the repo's cwd), durable server-side, and reused across turns by id.
 */

// --- binary resolution ------------------------------------------------------------------

// GUI-launched daemons inherit a minimal PATH, so we probe well-known install locations
// after the env override and PATH. Order matters: explicit override wins, then PATH, then
// the known homes (protocol notes §binary resolution).
const WELL_KNOWN_BINS = [
  join(homedir(), '.opencode', 'bin', 'opencode'),
  '/opt/homebrew/bin/opencode',
  '/usr/local/bin/opencode',
]

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function resolveOpencodeBin(): string | null {
  const override = process.env.PORCELAIN_OPENCODE_BIN
  if (override !== undefined && override !== '' && isExecutable(override)) return override
  for (const dir of (process.env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, 'opencode')
    if (isExecutable(candidate)) return candidate
  }
  for (const candidate of WELL_KNOWN_BINS) {
    if (isExecutable(candidate)) return candidate
  }
  return null
}

// --- server lifecycle -------------------------------------------------------------------

interface OpencodeServer {
  proc: ChildProcess
  baseUrl: string
}

const SERVER_BOOT_TIMEOUT_MS = 20_000
// opencode prints `opencode server listening on http://127.0.0.1:PORT` once bound. With
// `--port 0` the port is only knowable from stdout, so we parse it (protocol notes §1).
const LISTENING_RE = /listening on\s+(https?:\/\/\S+)/

// One server per repoPath (sessions are project-scoped). The value is the pending spawn so
// concurrent first turns share one server. A server that exits deletes its entry, so the
// next turn respawns.
const servers = new Map<string, Promise<OpencodeServer>>()
// Every live child, killed synchronously when the daemon process exits (best effort — a
// SIGKILL'd daemon runs nothing, but the normal stdin-EOF shutdown calls process.exit()).
const liveServers = new Set<ChildProcess>()
let cleanupRegistered = false

// WHY `process.on('exit')` is sufficient (no SIGTERM/SIGINT handler here): every daemon
// shutdown route funnels through `process.exit()` in server.ts — the SIGTERM the shell's
// utilityProcess.kill() sends and the SIGINT a standalone TTY daemon gets are both caught
// there and turned into `process.exit(0)`, and the stdin-EOF watchdog exits the same way.
// `process.exit()` fires 'exit' handlers, so this reaper runs on every real teardown. (A
// SIGKILL/-9 runs nothing anywhere — best-effort by definition.)
function registerCleanup(): void {
  if (cleanupRegistered) return
  cleanupRegistered = true
  process.on('exit', () => {
    for (const proc of liveServers) {
      try {
        proc.kill()
      } catch {
        // process already gone
      }
    }
  })
}

function spawnServer(bin: string, cwd: string): Promise<OpencodeServer> {
  registerCleanup()
  return new Promise<OpencodeServer>((resolve, reject) => {
    // terminalEnv strips the daemon token / ELECTRON_RUN_AS_NODE — never leak them into the
    // agent CLI. Arg array (never a shell string) so nothing is interpolated.
    const proc = spawn(bin, ['serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd,
      env: terminalEnv(process.env),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    liveServers.add(proc)
    let settled = false
    let stdout = ''
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      proc.kill()
      reject(new Error('opencode serve did not report a listening URL in time'))
    }, SERVER_BOOT_TIMEOUT_MS)

    proc.stdout?.on('data', (chunk: Buffer) => {
      if (settled) return
      stdout += chunk.toString('utf8')
      const match = stdout.match(LISTENING_RE)
      if (match) {
        settled = true
        clearTimeout(timer)
        resolve({ proc, baseUrl: match[1].replace(/\/+$/, '') })
      }
    })
    proc.on('error', (error) => {
      liveServers.delete(proc)
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    proc.on('exit', () => {
      liveServers.delete(proc)
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('opencode serve exited before it began listening'))
    })
  })
}

function getServer(repoPath: string): Promise<OpencodeServer> {
  const existing = servers.get(repoPath)
  if (existing) return existing
  const bin = resolveOpencodeBin()
  if (bin === null) return Promise.reject(new Error('opencode is not installed'))
  const pending = spawnServer(bin, repoPath)
  // On boot failure or when the process later exits, drop the entry so the next turn
  // respawns rather than reusing a dead server.
  pending.catch(() => servers.delete(repoPath))
  pending
    .then((server) => {
      server.proc.on('exit', () => {
        if (servers.get(repoPath) === pending) servers.delete(repoPath)
      })
    })
    .catch(() => {})
  servers.set(repoPath, pending)
  return pending
}

// --- HTTP helpers -----------------------------------------------------------------------

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

interface PromptPart {
  type: 'text' | 'file'
  text?: string
  mime?: string
  filename?: string
  url?: string
}

function buildParts(text: string, images: AgentImage[]): PromptPart[] {
  const parts: PromptPart[] = []
  if (text !== '') parts.push({ type: 'text', text })
  images.forEach((image, index) => {
    // Images arrive as base64 (remote-daemon/iPad: the repo may live on another machine),
    // so we hand opencode a data: URL rather than a file:// path it couldn't read.
    parts.push({
      type: 'file',
      mime: image.mediaType,
      filename: `image-${index + 1}`,
      url: `data:${image.mediaType};base64,${image.base64}`,
    })
  })
  return parts
}

function resumeSessionId(resume: unknown): string | null {
  return typeof resume === 'string' && resume.startsWith('ses_') ? resume : null
}

// OpenCode commands are flat `.md` files: repo-local `.opencode/command`, then user-global
// `~/.config/opencode/command`. Repo-local shadows global (listCommandFiles keeps the first).
function opencodeCommandDirs(repoPath: string): string[] {
  return [join(repoPath, '.opencode', 'command'), join(homedir(), '.config', 'opencode', 'command')]
}

function eventSessionId(properties: Record<string, unknown> | undefined): string | undefined {
  const value = properties?.sessionID
  return typeof value === 'string' ? value : undefined
}

// --- driver -----------------------------------------------------------------------------

export const opencodeDriver: AgentDriver = {
  provider: 'opencode',

  async status(): Promise<ProviderStatus> {
    const bin = resolveOpencodeBin()
    if (bin === null) {
      return { provider: 'opencode', installed: false, authenticated: false, models: [] }
    }
    const providers = await readAuthProviders()
    const models = await fetchModels(bin)
    return {
      provider: 'opencode',
      installed: true,
      authenticated: providers.length > 0,
      account: providers.length > 0 ? providers.join(', ') : undefined,
      models,
    }
  },

  // Flat `.md` command files under `.opencode/command` (repo) + `~/.config/opencode/command`.
  listCommands(repoPath: string): Promise<AgentCommand[]> {
    return listCommandFiles(opencodeCommandDirs(repoPath), false)
  },

  // OpenCode is BYO-provider-key and exposes NO usage/quota/limit endpoint (verified on
  // opencode 1.17.18 — nothing in the server OpenAPI or CLI), so it has no plan windows to
  // report. Always null; the Limits group hides for opencode. (Session cost still comes
  // through per-message `cost` — see opencode-translate's handleMessageUpdated.)
  limits(): Promise<ProviderLimits | null> {
    return Promise.resolve(null)
  },

  // No guaranteed-cheap one-shot title path (a prompt turn spins the full server + agent),
  // so we decline and let the manager keep the derived title.
  generateTitle(): Promise<string | null> {
    return Promise.resolve(null)
  },

  startTurn(opts: StartTurnOptions): TurnHandle {
    const abortController = new AbortController()
    const translator = createOpencodeTranslator(opts.mode)
    let sessionId: string | null = resumeSessionId(opts.resume)
    let baseUrl = ''
    let finished = false

    const finish = (ok: boolean): void => {
      if (finished) return
      finished = true
      abortController.abort() // tear down the SSE read
      opts.onDone({ ok })
    }

    const answerPermission = async (
      permissionId: string,
      response: OpencodePermissionResponse,
    ): Promise<void> => {
      if (sessionId === null) return
      // Best effort: a failed reply just leaves the turn blocked until abort — never throw.
      await postJson(
        `${baseUrl}/session/${sessionId}/permissions/${permissionId}`,
        { response },
        abortController.signal,
      ).catch(() => {})
    }

    const run = async (): Promise<void> => {
      const server = await getServer(opts.repoPath)
      baseUrl = server.baseUrl

      // Subscribe to the event stream BEFORE prompting so no early frame is missed (§11).
      const stream = await fetch(`${baseUrl}/event`, { signal: abortController.signal })
      if (!stream.body) throw new Error('opencode event stream had no body')

      if (sessionId === null) {
        const created = await postJson(
          `${baseUrl}/session`,
          { title: 'Porcelain thread' },
          abortController.signal,
        )
        const session: unknown = await created.json()
        const id =
          typeof session === 'object' && session !== null && 'id' in session
            ? (session as { id?: unknown }).id
            : undefined
        if (typeof id !== 'string') throw new Error('opencode did not return a session id')
        sessionId = id
        opts.onSessionState(sessionId) // persist so the next turn resumes this session
      }

      const split = splitModelId(opts.model)
      // Reasoning effort rides the prompt as the model `variant` (OpenCode's mechanism);
      // omitted when unset so the model's own default applies.
      const variant = opts.options.effort
      // The prompt endpoint takes the text literally — `/name` expansion is an OpenCode TUI
      // feature — so we expand custom commands driver-side. A non-command message is
      // unchanged.
      const promptText = await expandSlashCommand(
        opts.text,
        opencodeCommandDirs(opts.repoPath),
        false,
      )
      await postJson(
        `${baseUrl}/session/${sessionId}/prompt_async`,
        {
          // WHY: the prompt body's model key is `modelID` (vs `id` on POST /session).
          model: split ? { providerID: split.providerID, modelID: split.modelID } : undefined,
          ...(variant !== undefined && variant !== '' ? { variant } : {}),
          // Plan mode selects opencode's built-in read-only `plan` agent for this prompt;
          // omitted in Build so the server default (`build`) applies.
          ...(opts.interaction === 'plan' ? { agent: 'plan' } : {}),
          parts: buildParts(promptText, opts.images),
        },
        abortController.signal,
      )

      await readEventStream(stream.body)
    }

    const readEventStream = async (body: ReadableStream<Uint8Array>): Promise<void> => {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = drainSseLines(buffer)
        buffer = rest
        for (const raw of events) {
          const sid = eventSessionId(raw.properties)
          // Multiple sessions multiplex on one stream — ignore other sessions' frames.
          if (sid !== undefined && sid !== sessionId) continue
          const result = translator.handle(raw)
          for (const event of result.events) opts.emit(event)
          if (result.autoApprovePermissionId !== undefined) {
            await answerPermission(result.autoApprovePermissionId, 'always')
          }
          if (result.done) {
            finish(result.done.ok)
            return
          }
        }
      }
      // Stream ended without a session.idle/error (server crash, aborted fetch): finalize
      // any open items and end the turn so it never hangs.
      for (const event of translator.finalize()) opts.emit(event)
      finish(false)
    }

    run().catch((error: unknown) => {
      if (finished) return
      const message = error instanceof Error ? error.message : 'The opencode turn failed.'
      opts.emit({ t: 'item', item: { kind: 'error', id: randomUUID(), message } })
      finish(false)
    })

    return {
      abort(): void {
        if (sessionId !== null) {
          postJson(`${baseUrl}/session/${sessionId}/abort`, {}).catch(() => {})
        }
        // Finalize open items then end the turn (guarded to fire once).
        for (const event of translator.finalize()) opts.emit(event)
        finish(false)
      },
      respondApproval(requestId, decision): void {
        for (const event of translator.resolveApproval(requestId, decision)) opts.emit(event)
        answerPermission(requestId, permissionResponseFor(decision)).catch(() => {})
      },
    }
  },
}

// --- status helpers ---------------------------------------------------------------------

const AUTH_PATH = join(homedir(), '.local', 'share', 'opencode', 'auth.json')

async function readAuthProviders(): Promise<string[]> {
  try {
    const raw = await readFile(AUTH_PATH, 'utf8')
    return parseAuthProviders(JSON.parse(raw))
  } catch {
    return [] // no creds file / unreadable → no providers connected
  }
}

/**
 * The model catalog needs a running server for `GET /config/providers` (human labels). We
 * reuse an already-running per-repo server when one exists, else spawn a short-lived one in
 * the home dir. On any failure, fall back to the `opencode models` CLI (ids only).
 */
async function fetchModels(bin: string): Promise<ModelInfo[]> {
  for (const pending of servers.values()) {
    try {
      const server = await pending
      const config = await getConfigProviders(server.baseUrl)
      if (config !== null) return mapProvidersConfig(config)
    } catch {
      // fall through to an ephemeral server
    }
  }
  const ephemeral = await spawnServer(bin, homedir()).catch(() => null)
  if (ephemeral) {
    try {
      const config = await getConfigProviders(ephemeral.baseUrl)
      if (config !== null) return mapProvidersConfig(config)
    } finally {
      liveServers.delete(ephemeral.proc)
      ephemeral.proc.kill()
    }
  }
  return modelsFromCli(bin)
}

async function getConfigProviders(baseUrl: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${baseUrl}/config/providers`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function modelsFromCli(bin: string): Promise<ModelInfo[]> {
  return new Promise((resolve) => {
    execFile(bin, ['models'], { env: terminalEnv(process.env) }, (error, stdout) => {
      resolve(error ? [] : parseModelsCli(stdout))
    })
  })
}

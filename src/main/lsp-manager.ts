import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'
import { app } from 'electron'
import { emitAppEvent } from './app-events'
import {
  createMessageBuffer,
  type Diagnostic,
  encodeMessage,
  type HoverInfo,
  type LspPosition,
  type MessageBuffer,
  type SymbolLocation,
  toDiagnostics,
  toHoverInfo,
  toSymbolLocations,
} from './lsp'
import { isRepoContained } from './review-store'

// The impure half of the TS-language-server integration. One server child per repo,
// keyed in a Map, spawned lazily on first use — when the renderer never calls an lsp
// procedure (feature off), nothing here ever runs. Modeled on terminal-manager: a
// long-lived child-process subsystem owned by main, cleaned up on quit. All the
// parsing/conversion lives in the pure `lsp.ts`; this file owns spawn, the JSON-RPC
// request/response correlation, the diagnostics cache, and crash recovery.

// A response is either a result or an error; we settle the pending promise from whichever.
interface JsonRpcResponse {
  id?: number | string
  result?: unknown
  error?: { message?: string }
  method?: string
  params?: unknown
}

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

interface ServerHandle {
  child: ChildProcessWithoutNullStreams
  buffer: MessageBuffer
  nextId: number
  pending: Map<number, PendingRequest>
  initialized: Promise<void>
  // Latest diagnostics per file, fs-path keyed; replaced wholesale on each publish.
  diagnostics: Map<string, Diagnostic[]>
  // Open documents' versions so didChange can bump monotonically.
  versions: Map<string, number>
  // Repo-relative paths currently open in THIS server. Per-handle (not a module
  // global) so a crash+respawn drops it with the rest of the state — otherwise
  // ensureOpen would skip re-opening a doc the fresh server never received.
  openDocs: Set<string>
  // Resolves once tsserver reports the project finished loading (the first
  // workDoneProgress 'end'), or after READY_TIMEOUT_MS as a fallback. Semantic
  // requests await it so they don't race the program build. One-shot — later
  // re-analysis progress cycles are background work and never re-block requests.
  ready: Promise<void>
  markReady: () => void
}

const servers = new Map<string, ServerHandle>()

// A hung server should reject rather than hang a renderer query forever.
const REQUEST_TIMEOUT_MS = 15_000

// tsserver resolves cross-file symbols to a bare import (or nothing) until it has
// built the project's program — so the FIRST hover/definition/references after a
// file opens races project loading and returns a useless result. The server
// announces load completion via a workDoneProgress 'end'; semantic requests await
// that (`handle.ready`). This cap is the fallback so a project that never reports
// 'end' (an older server, an edge case) can't block a request forever.
const READY_TIMEOUT_MS = 10_000

// Resolve the language-server entry, rewriting the asar path to its unpacked
// sibling in a packaged app (the child Node process reads the .mjs off disk, and
// app.asar isn't a real directory). In dev the resolved path is a plain file.
function serverEntry(): string {
  const entry = require.resolve('typescript-language-server/lib/cli.mjs')
  return app.isPackaged ? entry.replace('app.asar', 'app.asar.unpacked') : entry
}

// ts/tsx/js/jsx → the LSP languageId the server keys parsing off. Defaults to
// typescript so an unknown-but-opened file still gets sensible handling.
function languageIdFor(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.tsx':
      return 'typescriptreact'
    case '.jsx':
      return 'javascriptreact'
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript'
    default:
      return 'typescript'
  }
}

function fileUri(repo: string, file: string): string {
  return pathToFileURL(join(repo, file)).href
}

// Write a request and return a promise settled by its response (by id). Rejects on
// timeout so a wedged server frees the caller. Notifications use `notify` instead.
function request(handle: ServerHandle, method: string, params: unknown): Promise<unknown> {
  const id = handle.nextId++
  handle.child.stdin.write(encodeMessage({ jsonrpc: '2.0', id, method, params }))
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      handle.pending.delete(id)
      reject(new Error(`lsp request "${method}" timed out`))
    }, REQUEST_TIMEOUT_MS)
    handle.pending.set(id, { resolve, reject, timer })
  })
}

function notify(handle: ServerHandle, method: string, params: unknown): void {
  handle.child.stdin.write(encodeMessage({ jsonrpc: '2.0', method, params }))
}

// Route one decoded message: a response settles its pending request; a
// publishDiagnostics notification refreshes the cache and pings the renderer.
function handleMessage(handle: ServerHandle, message: JsonRpcResponse): void {
  if (typeof message.id === 'number' && (message.result !== undefined || message.error)) {
    const pending = handle.pending.get(message.id)
    if (!pending) return
    handle.pending.delete(message.id)
    clearTimeout(pending.timer)
    if (message.error) pending.reject(new Error(message.error.message ?? 'lsp error'))
    else pending.resolve(message.result)
    return
  }
  // tsserver reports project loading via workDoneProgress. The create is a
  // server→client REQUEST — the spec requires a reply, and without one the server
  // can withhold the progress notifications we key readiness off. The first
  // progress 'end' means the program is built → semantic requests are reliable.
  if (message.method === 'window/workDoneProgress/create' && message.id !== undefined) {
    handle.child.stdin.write(encodeMessage({ jsonrpc: '2.0', id: message.id, result: null }))
    return
  }
  if (message.method === '$/progress') {
    const value = (message.params as { value?: { kind?: string } } | undefined)?.value
    if (value?.kind === 'end') handle.markReady()
    return
  }
  if (message.method === 'textDocument/publishDiagnostics') {
    const params = message.params as
      | { uri: string; diagnostics: Parameters<typeof toDiagnostics>[0] }
      | undefined
    if (!params) return
    let path: string
    try {
      // Decode the file:// uri to the same absolute fs path `lspDiagnostics`
      // reads back (`join(repo, file)`), so the cache key matches on both sides.
      path = fileURLToPath(params.uri)
    } catch {
      return
    }
    handle.diagnostics.set(path, toDiagnostics(params.diagnostics))
    emitAppEvent('diagnostics')
  }
}

// Reject every in-flight request and drop the server from the Map so the next call
// re-spawns. Called on exit/crash and on explicit shutdown.
function dropServer(repo: string, handle: ServerHandle, reason: string): void {
  for (const [, pending] of handle.pending) {
    clearTimeout(pending.timer)
    pending.reject(new Error(reason))
  }
  handle.pending.clear()
  // Unblock any request parked on `ready` (the next write fails on the dead child
  // and rejects, instead of hanging until READY_TIMEOUT_MS).
  handle.markReady()
  if (servers.get(repo) === handle) servers.delete(repo)
}

// Spawn + handshake. Memoized via the Map: concurrent first-callers all await the
// same `initialized` promise, so the handshake runs exactly once per repo.
function ensureServer(repo: string): ServerHandle {
  const existing = servers.get(repo)
  if (existing) return existing

  const child = spawn(process.execPath, [serverEntry(), '--stdio'], {
    cwd: repo,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams

  const buffer = createMessageBuffer()
  let markReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    markReady = resolve
  })
  const handle: ServerHandle = {
    child,
    buffer,
    nextId: 1,
    pending: new Map(),
    initialized: Promise.resolve(), // replaced below before any await observes it
    diagnostics: new Map(),
    versions: new Map(),
    openDocs: new Set(),
    ready,
    markReady,
  }
  servers.set(repo, handle)
  // Fallback so an awaited request can't hang if the project never reports 'end'.
  // Resolving an already-resolved promise is a no-op, so the real 'end' (or a
  // crash drop) winning the race is fine.
  setTimeout(() => handle.markReady(), READY_TIMEOUT_MS)

  child.stdout.on('data', (chunk: Buffer) => {
    for (const message of buffer.push(chunk)) {
      handleMessage(handle, message as JsonRpcResponse)
    }
  })
  // Surface the server's own logs only in dev — they're noise in production.
  child.stderr.on('data', (chunk: Buffer) => {
    if (is.dev) console.error('[lsp]', chunk.toString('utf8').trim())
  })
  child.on('exit', () => dropServer(repo, handle, 'lsp server exited'))
  child.on('error', (error) => dropServer(repo, handle, `lsp server error: ${error.message}`))

  handle.initialized = handshake(repo, handle)
  return handle
}

async function handshake(repo: string, handle: ServerHandle): Promise<void> {
  await request(handle, 'initialize', {
    processId: process.pid,
    rootUri: pathToFileURL(repo).href,
    capabilities: {
      // Opt into work-done progress so tsserver reports project-load begin/end —
      // `handle.ready` keys off the 'end' to know when semantics are reliable.
      window: { workDoneProgress: true },
      textDocument: {
        hover: { contentFormat: ['markdown', 'plaintext'] },
        definition: { linkSupport: true },
        references: {},
        publishDiagnostics: {},
        // Full document sync: every change ships the whole file (we never compute
        // incremental edits), so the server must accept full text on didChange.
        synchronization: { dynamicRegistration: false },
      },
    },
  })
  notify(handle, 'initialized', {})
}

async function readyServer(repo: string): Promise<ServerHandle> {
  const handle = ensureServer(repo)
  await handle.initialized
  return handle
}

// --- Public API (all async; convert via lsp.ts; never `void` a promise) ------

export async function lspDidOpen(repo: string, file: string, content: string): Promise<void> {
  // Every entry point clamps `file` to the repo before it reaches `join(repo, file)`
  // (matching the review-set channel's posture) — a `..`-escape or absolute path must
  // never be handed to the language server as a document to open or query.
  if (!isRepoContained(repo, file)) return
  const handle = await readyServer(repo)
  handle.versions.set(file, 1)
  handle.openDocs.add(file)
  notify(handle, 'textDocument/didOpen', {
    textDocument: {
      uri: fileUri(repo, file),
      languageId: languageIdFor(file),
      version: 1,
      text: content,
    },
  })
}

export async function lspDidChange(repo: string, file: string, content: string): Promise<void> {
  if (!isRepoContained(repo, file)) return
  const handle = await readyServer(repo)
  const version = (handle.versions.get(file) ?? 1) + 1
  handle.versions.set(file, version)
  // Full-sync: the single change range IS the whole document.
  notify(handle, 'textDocument/didChange', {
    textDocument: { uri: fileUri(repo, file), version },
    contentChanges: [{ text: content }],
  })
}

export async function lspDidClose(repo: string, file: string): Promise<void> {
  if (!isRepoContained(repo, file)) return
  const handle = await readyServer(repo)
  handle.openDocs.delete(file)
  handle.versions.delete(file)
  handle.diagnostics.delete(join(repo, file))
  notify(handle, 'textDocument/didClose', {
    textDocument: { uri: fileUri(repo, file) },
  })
}

// Open-on-demand so a hover works even if the renderer never sent didOpen. We send
// an empty open (the server reads from disk via its own fs on the project anyway).
async function ensureOpen(handle: ServerHandle, repo: string, file: string): Promise<void> {
  if (handle.openDocs.has(file)) return
  // Best-effort open without content — the server resolves the file from the
  // project it already loaded. A subsequent real didOpen (version 1) is harmless.
  handle.openDocs.add(file)
  notify(handle, 'textDocument/didOpen', {
    textDocument: {
      uri: fileUri(repo, file),
      languageId: languageIdFor(file),
      version: handle.versions.get(file) ?? 1,
      text: '',
    },
  })
}

export async function lspHover(
  repo: string,
  file: string,
  pos: LspPosition,
): Promise<HoverInfo | null> {
  if (!isRepoContained(repo, file)) return null
  const handle = await readyServer(repo)
  await ensureOpen(handle, repo, file)
  // Wait out project loading so the symbol resolves to its real target, not a
  // bare import (or nothing). Bounded by READY_TIMEOUT_MS.
  await handle.ready
  const result = await request(handle, 'textDocument/hover', {
    textDocument: { uri: fileUri(repo, file) },
    position: { line: pos.line, character: pos.character },
  })
  return toHoverInfo(result as Parameters<typeof toHoverInfo>[0])
}

export async function lspDefinition(
  repo: string,
  file: string,
  pos: LspPosition,
): Promise<SymbolLocation[]> {
  if (!isRepoContained(repo, file)) return []
  const handle = await readyServer(repo)
  await ensureOpen(handle, repo, file)
  // Wait out project loading so the symbol resolves to its real target, not a
  // bare import (or nothing). Bounded by READY_TIMEOUT_MS.
  await handle.ready
  const result = await request(handle, 'textDocument/definition', {
    textDocument: { uri: fileUri(repo, file) },
    position: { line: pos.line, character: pos.character },
  })
  return toSymbolLocations(result as Parameters<typeof toSymbolLocations>[0])
}

export async function lspReferences(
  repo: string,
  file: string,
  pos: LspPosition,
): Promise<SymbolLocation[]> {
  if (!isRepoContained(repo, file)) return []
  const handle = await readyServer(repo)
  await ensureOpen(handle, repo, file)
  // Wait out project loading so the symbol resolves to its real target, not a
  // bare import (or nothing). Bounded by READY_TIMEOUT_MS.
  await handle.ready
  const result = await request(handle, 'textDocument/references', {
    textDocument: { uri: fileUri(repo, file) },
    position: { line: pos.line, character: pos.character },
    context: { includeDeclaration: true },
  })
  return toSymbolLocations(result as Parameters<typeof toSymbolLocations>[0])
}

// Synchronous read of the cached latest diagnostics for a file (pushed via
// publishDiagnostics → the `diagnostics` app-event). Empty until the server publishes.
export function lspDiagnostics(repo: string, file: string): Diagnostic[] {
  if (!isRepoContained(repo, file)) return []
  const handle = servers.get(repo)
  if (!handle) return []
  return handle.diagnostics.get(join(repo, file)) ?? []
}

// Kill every server — called on app quit. Best-effort; the OS reaps anything that
// ignores the signal.
export function shutdownAllLsp(): void {
  for (const [repo, handle] of servers) {
    dropServer(repo, handle, 'app quitting')
    handle.child.kill()
  }
  servers.clear()
}

import { REQUEST_TIMEOUT_MS } from '@porcelain/client-runtime/session/transport'
import { MAX_TERMINAL_WRITE_CODE_UNITS } from '@porcelain/contracts/terminal'
import { randomUUID } from 'expo-crypto'

import { DaemonError } from './errors'
import { daemonSession, sessionClientRuntime } from './session'

/**
 * The terminal half of the daemon session — the one place this client speaks PTY.
 *
 * A terminal is a live bidirectional byte stream, not request/response data, so it rides
 * the session socket rather than tRPC (the roster and saved actions are data and stay on
 * tRPC, in `procedures/terminal.ts`). PTYs are daemon-owned: they survive this app being
 * backgrounded, the socket dropping, and the screen unmounting. Closing a screen DETACHES;
 * only `killTerminal` ends a shell.
 *
 * Frames are the terminal stream contract (`@porcelain/contracts/terminal`). Correlation for
 * create/attach/paste is `reqId` over `daemonSession.request` + `onTerminalFrame`.
 */

/** One `terminal:write` frame stays well under any proxy's message cap. */
const WRITE_CHUNK = MAX_TERMINAL_WRITE_CODE_UNITS

export type TerminalAttachResult = {
  /** False when the daemon has never heard of this id — killed, or a stale roster row. */
  found: boolean
  scrollback: string
  status: 'running' | 'exited'
  exitCode?: number
}

/**
 * The ids this client is streaming. Re-sent as `terminal:attach` on every reconnect: session
 * state is per-socket daemon-side, so a dropped socket silently stops the feed otherwise.
 */
const attachedIds = new Set<string>()

/**
 * A session still handshaking drops anything pushed into it, and a create/attach correlates
 * its reply by `reqId` — so an early push would leave the caller waiting out the full timeout
 * for a reply the daemon was never asked for. Wait for ready instead of racing it.
 *
 * Deliberately not a replay queue: re-sending a stale `terminal:create` after a long outage
 * would spawn a shell nobody is still waiting for.
 */
async function whenOpen(): Promise<void> {
  // Adapter `open` is the socket; terminal send is no-op until the runtime has `ready`.
  if (sessionClientRuntime().status() === 'open') return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      off()
      reject(
        new DaemonError(
          'unreachable',
          'terminal',
          'The daemon connection is not up. Check the environment in Settings and try again.',
        ),
      )
    }, REQUEST_TIMEOUT_MS)
    const off = daemonSession.onOpen(() => {
      clearTimeout(timer)
      off()
      resolve()
    })
  })
}

/** Spawn a PTY in `cwd`; resolves with the daemon-minted id via the reqId-correlated reply. */
export async function createTerminal(opts: {
  cwd: string
  name: string
  initialInput?: string
  cols?: number
  rows?: number
}): Promise<string> {
  await whenOpen()
  const reqId = randomUUID()
  const reply = await daemonSession.request(
    { ...opts, reqId, t: 'terminal:create' },
    (frame) => (frame.t === 'terminal:created' && frame.reqId === reqId ? frame : null),
    { timeoutMs: REQUEST_TIMEOUT_MS },
  )
  // The daemon answers a refused create (its session cap) with an empty id — that message has
  // no error channel, and an unsettled promise would wedge the caller.
  if (reply.id === '') {
    throw new DaemonError(
      'unreachable',
      'terminal:create',
      'The daemon has too many terminal sessions open. Close one and try again.',
    )
  }
  attachedIds.add(reply.id)
  return reply.id
}

/**
 * Attach to a daemon-owned PTY and replay its scrollback. Idempotent per socket: the daemon
 * fans output out to every attached sender, so a second attach just re-sends the snapshot.
 */
export async function attachTerminal(id: string): Promise<TerminalAttachResult> {
  await whenOpen()
  const reqId = randomUUID()
  attachedIds.add(id)
  try {
    const reply = await daemonSession.request(
      { id, reqId, t: 'terminal:attach' },
      (frame) => (frame.t === 'terminal:attached' && frame.reqId === reqId ? frame : null),
      { timeoutMs: REQUEST_TIMEOUT_MS },
    )
    if (!reply.found) attachedIds.delete(id)
    return {
      exitCode: reply.exitCode,
      found: reply.found,
      scrollback: reply.scrollback,
      status: reply.status,
    }
  } catch (cause) {
    // A socket drop rejects the attach — forget the id so `isTerminalAttached` stays honest
    // and the next roster read re-attaches it.
    attachedIds.delete(id)
    throw cause
  }
}

/** Stop streaming this PTY to this client. The PTY lives on — only `kill` ends it. */
export function detachTerminal(id: string): void {
  attachedIds.delete(id)
  daemonSession.send({ id, t: 'terminal:detach' })
}

export function isTerminalAttached(id: string): boolean {
  return attachedIds.has(id)
}

export type PasteImageResult = {
  result: 'ok' | 'too-large' | 'no-session' | 'write-failed'
  path?: string
}

/**
 * Send a pasted image to the daemon for `id`'s session. The daemon writes it to disk
 * (never this client's job — the PTY it needs to reach is on the daemon's machine, not
 * this device) and types a natural-language mention of the path into the shell, the same
 * way `writeTerminal` types real keystrokes. This client only needs the result to decide
 * whether to tell the user it failed.
 */
export async function pasteImageToTerminal(
  id: string,
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
  dataBase64: string,
  options?: { insert?: boolean },
): Promise<PasteImageResult> {
  await whenOpen()
  const reqId = randomUUID()
  const reply = await daemonSession.request(
    { dataBase64, id, mime, reqId, t: 'terminal:paste-image', ...options },
    (frame) => (frame.t === 'terminal:image-pasted' && frame.reqId === reqId ? frame : null),
    { timeoutMs: REQUEST_TIMEOUT_MS },
  )
  return { path: reply.path, result: reply.result }
}

/** Transfer a picked device file as bytes; the daemon mints the only terminal-visible path. */
export async function pasteFileToTerminal(
  id: string,
  filename: string,
  mime: string,
  dataBase64: string,
  options?: { insert?: boolean },
): Promise<PasteImageResult> {
  await whenOpen()
  const reqId = randomUUID()
  const reply = await daemonSession.request(
    { dataBase64, filename, id, mime, reqId, t: 'terminal:paste-file', ...options },
    (frame) => (frame.t === 'terminal:file-pasted' && frame.reqId === reqId ? frame : null),
    { timeoutMs: REQUEST_TIMEOUT_MS },
  )
  return { path: reply.path, result: reply.result }
}

export function writeTerminal(id: string, data: string): void {
  if (data === '') return
  for (let offset = 0; offset < data.length; offset += WRITE_CHUNK) {
    daemonSession.send({ data: data.slice(offset, offset + WRITE_CHUNK), id, t: 'terminal:write' })
  }
}

/** One deliberate PTY write for a fully prepared composer payload. */
export function writeTerminalAtomically(id: string, data: string): void {
  if (data === '' || data.length > MAX_TERMINAL_WRITE_CODE_UNITS) return
  daemonSession.send({ data, id, t: 'terminal:write' })
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols <= 0 || rows <= 0) return
  daemonSession.send({ cols, id, rows, t: 'terminal:resize' })
}

/** End the PTY for good. The roster row goes with it — this is the only thing that kills. */
export function killTerminal(id: string): void {
  attachedIds.delete(id)
  daemonSession.send({ id, t: 'terminal:kill' })
}

type StreamHandlers = {
  onData: (id: string, data: string) => void
  onExit: (id: string, exitCode: number) => void
  /** The replay snapshot that answers an attach, before any live data follows it. */
  onScrollback: (id: string, scrollback: string) => void
}

/**
 * Consume the inbound half of the stream. Mounted once by `useTerminals`; returns an
 * unsubscribe. Also re-attaches every streaming id after a reconnect, because the daemon
 * keeps attachment state per socket and the old one is gone.
 */
export function subscribeTerminalStream(handlers: StreamHandlers): () => void {
  const stopMessages = daemonSession.subscribeTerminal((frame) => {
    if (frame.t === 'terminal:data') handlers.onData(frame.id, frame.data)
    else if (frame.t === 'terminal:exit') handlers.onExit(frame.id, frame.exitCode)
    else if (frame.t === 'terminal:attached' && frame.found) {
      handlers.onScrollback(frame.id, frame.scrollback)
    }
  })
  const stopReconnect = daemonSession.onReconnect(() => {
    for (const id of [...attachedIds]) {
      attachTerminal(id).catch(() => {
        // The next roster read re-attaches; a failed re-attach must not break the others.
      })
    }
  })
  return () => {
    stopMessages()
    stopReconnect()
  }
}

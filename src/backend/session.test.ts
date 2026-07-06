// @vitest-environment node
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { serverMessageSchema } from '../shared/ws-protocol'

// Same node-pty wall as daemon-http.test.ts: session.ts statically imports
// terminal-manager (→ node-pty). Mock it (hoisted) so the import never loads the
// native module; killTerminal stays a spy so we can prove close DOESN'T call it.
vi.mock('./terminal-manager', () => ({
  createTerminal: vi.fn(() => 'term-1'),
  attachTerminal: vi.fn(() => ({ scrollback: '', status: 'running' as const })),
  detachTerminal: vi.fn(),
  detachSender: vi.fn(),
  killTerminal: vi.fn(),
  writeTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
}))

// file-watch is real code (node:fs), but the session unit test only cares that
// the routing lands — mock the four entry points session.ts calls as spies.
vi.mock('./file-watch', () => ({
  setWatchedFiles: vi.fn(),
  setWatchedDirs: vi.fn(),
  clearWatchedFiles: vi.fn(),
  clearWatchedDirs: vi.fn(),
}))

import { clearWatchedDirs, clearWatchedFiles, setWatchedFiles } from './file-watch'
import { broadcastAppEvent, createSession } from './session'
import { detachSender, killTerminal } from './terminal-manager'

// A minimal fake ws.WebSocket: an EventEmitter with a `send` spy and a settable
// `readyState`, so we can drive `message`/`close` and control the OPEN check
// synchronously — no real socket (Step 3's daemon-http tests already prove the
// real transport). The single `as WebSocket` is permitted, not the banned double
// cast: ws's WebSocket is assignable to this type (it IS an EventEmitter with
// `readyState` + `send`), so TS accepts the assertion directly.
class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN
  send: (data: string) => void = vi.fn()
}

// A structural view of a Session — exactly the TerminalSender/FileWatchSender
// surface — captured from a spy so we can call `.send` on the real instance.
type Sender = { send: (channel: string, ...args: unknown[]) => void }

// Drive a fresh session over a fake socket and hand back both ends.
function openSession(): { socket: FakeSocket; session: Sender } {
  const socket = new FakeSocket()
  createSession(socket as WebSocket)
  // The session registers itself with file-watch on the first watch message; emit
  // one so we capture the live instance (its `.send` is the TerminalSender shuttle).
  socket.emit('message', Buffer.from(JSON.stringify({ t: 'watch:files', paths: [] })))
  const session = vi.mocked(setWatchedFiles).mock.calls.at(-1)?.[0] as Sender
  return { socket, session }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('session dispatch', () => {
  it('routes watch:files to setWatchedFiles with the session and paths', () => {
    const socket = new FakeSocket()
    createSession(socket as WebSocket)
    socket.emit(
      'message',
      Buffer.from(JSON.stringify({ t: 'watch:files', paths: ['/a.ts', '/b.ts'] })),
    )
    expect(setWatchedFiles).toHaveBeenCalledTimes(1)
    const [sender, paths] = vi.mocked(setWatchedFiles).mock.calls[0] ?? []
    expect(paths).toEqual(['/a.ts', '/b.ts'])
    expect(typeof (sender as Sender | undefined)?.send).toBe('function')
  })

  it('broadcasts an app-event to open sessions and skips a non-OPEN one', () => {
    const open = new FakeSocket()
    const closed = new FakeSocket()
    createSession(open as WebSocket)
    createSession(closed as WebSocket)
    // Still in the sessions set (never emitted 'close'), but the socket is not OPEN:
    // the push guard must no-op for it.
    closed.readyState = WebSocket.CLOSED

    broadcastAppEvent('board')

    expect(open.send).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(open.send).mock.calls[0]?.[0] ?? '')).toEqual({
      t: 'app-event',
      event: 'board',
    })
    expect(closed.send).not.toHaveBeenCalled()
  })

  it('on close clears watchers and detaches — but never kills the PTY', () => {
    const socket = new FakeSocket()
    createSession(socket as WebSocket)

    socket.emit('close')

    expect(clearWatchedFiles).toHaveBeenCalledTimes(1)
    expect(clearWatchedDirs).toHaveBeenCalledTimes(1)
    expect(detachSender).toHaveBeenCalledTimes(1)
    // The invariant: a dropped socket detaches, it does NOT end the PTY.
    expect(killTerminal).not.toHaveBeenCalled()
  })

  it('translates a send("terminal:data", ...) into a schema-valid message', () => {
    const { socket, session } = openSession()
    session.send('terminal:data', 'id1', 'hello')

    const raw = vi.mocked(socket.send).mock.calls.at(-1)?.[0] ?? ''
    const parsed = serverMessageSchema.parse(JSON.parse(raw))
    expect(parsed).toEqual({ t: 'terminal:data', id: 'id1', data: 'hello' })
  })
})

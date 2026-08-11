// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// node-pty is the one native module, and a real PTY here would spawn a real login shell
// per test (the exact pile-up these bounds exist to prevent). Mock it hoisted so the
// import never loads pty.node: `spawn` hands back a fake IPty and records it, and the
// test drives output/exit through the listeners the manager registered on it.
vi.mock('node-pty', () => ({ spawn: () => makePty() }))

import {
  attachTerminal,
  createTerminal,
  DETACHED_IDLE_MS,
  detachSender,
  detachTerminal,
  EXITED_RETENTION_MS,
  killTerminal,
  listTerminals,
  MAX_SESSIONS,
  sweepTerminals,
  type TerminalSender,
} from './terminal-manager'

/** The slice of `IPty` terminal-manager touches, plus test triggers for data/exit. */
interface FakePty {
  onData: (listener: (data: string) => void) => void
  onExit: (listener: (event: { exitCode: number }) => void) => void
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: (signal?: string) => void
  emitData: (data: string) => void
  emitExit: (exitCode: number) => void
}

/** Every fake PTY spawned in the current test, in creation order. */
const ptys: FakePty[] = []

function makePty(): FakePty {
  let data: (chunk: string) => void = () => {}
  let exit: (event: { exitCode: number }) => void = () => {}
  const pty: FakePty = {
    onData: (listener: (data: string) => void) => {
      data = listener
    },
    onExit: (listener: (event: { exitCode: number }) => void) => {
      exit = listener
    },
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    emitData: (chunk: string) => data(chunk),
    emitExit: (exitCode: number) => exit({ exitCode }),
  }
  ptys.push(pty)
  return pty
}

/** A TerminalSender whose `isDestroyed` the test can flip (a socket that died silently). */
interface FakeSender extends TerminalSender {
  destroyed: boolean
}

function makeSender(): FakeSender {
  const sender: FakeSender = {
    destroyed: false,
    send: vi.fn(),
    isDestroyed: () => sender.destroyed,
  }
  return sender
}

// Fake timers give us the system clock (so `createdAt`/`exitedAt`/`detachedSince` are
// deterministic) AND keep the lazily-started sweep interval off the real event loop.
// The sweep itself is driven by calling `sweepTerminals(now)` directly — no timer
// gymnastics — so a test can jump 12h without waiting for anything.
let clock = 1_700_000_000_000

/** Spawn a session, bumping the clock so `createdAt` orders evictions predictably. */
function create(sender: TerminalSender, name = 'shell'): string {
  clock += 1_000
  vi.setSystemTime(clock)
  return createTerminal(sender, { name, cwd: '/repo' })
}

const ids = (): string[] => listTerminals().map((info) => info.id)

beforeEach(() => {
  vi.useFakeTimers()
  clock = 1_700_000_000_000
  vi.setSystemTime(clock)
})

afterEach(() => {
  // Reset module-level state through the production API:
  // kill every session this test left behind, then forget the fakes.
  for (const info of listTerminals()) killTerminal(info.id)
  ptys.length = 0
  vi.useRealTimers()
})

describe('exited-session retention', () => {
  it('reaps an exited, detached session only once the retention window is past', () => {
    const sender = makeSender()
    const id = create(sender)
    ptys[0]?.emitExit(0)
    detachTerminal(id, sender)
    const exitedAt = clock

    // The point of keeping the entry: final output survives a reload.
    sweepTerminals(exitedAt + EXITED_RETENTION_MS)
    expect(ids()).toEqual([id])
    expect(listTerminals()[0]?.status).toBe('exited')

    sweepTerminals(exitedAt + EXITED_RETENTION_MS + 1)
    expect(ids()).toEqual([])
  })

  it('keeps an exited session someone is still attached to, and reaps it after they detach', () => {
    const sender = makeSender()
    const id = create(sender)
    ptys[0]?.emitExit(0)
    const exitedAt = clock
    const wellPast = exitedAt + EXITED_RETENTION_MS * 10

    sweepTerminals(wellPast)
    expect(ids()).toEqual([id])

    detachTerminal(id, sender)
    sweepTerminals(wellPast)
    expect(ids()).toEqual([])
  })
})

describe('explicit kill', () => {
  it('kills the PTY and forgets the session', () => {
    const sender = makeSender()
    const id = create(sender)

    killTerminal(id)

    expect(ptys[0]?.kill).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual([])
  })

  /**
   * `evict` deletes the entry before killing so `onExit`'s guard skips the fan-out, which means a
   * kill is the one terminal event no client is told about. The mobile roster learned this the
   * hard way: it waited for a `terminal:exit` that never came and left a dead shell on screen. A
   * client that asks for a kill has to drop the row itself — if this ever starts emitting, that
   * is a contract change, not an implementation detail.
   */
  it('tells no one — an explicit kill sends no exit to attached clients', () => {
    const sender = makeSender()
    const id = create(sender)
    vi.mocked(sender.send).mockClear()

    killTerminal(id)

    expect(sender.send).not.toHaveBeenCalled()
  })
})

describe('detached-idle TTL', () => {
  it('never reaps a running session with an attached client, however old', () => {
    const sender = makeSender()
    const id = create(sender)

    sweepTerminals(clock + DETACHED_IDLE_MS * 100)

    expect(ids()).toEqual([id])
    expect(ptys[0]?.kill).not.toHaveBeenCalled()
  })

  it('kills and forgets a running session detached longer than the TTL', () => {
    const sender = makeSender()
    const id = create(sender)
    detachTerminal(id, sender)
    const detachedAt = clock

    // 12h is deliberately generous — a background dev server must survive the night.
    sweepTerminals(detachedAt + DETACHED_IDLE_MS)
    expect(ids()).toEqual([id])
    expect(ptys[0]?.kill).not.toHaveBeenCalled()

    sweepTerminals(detachedAt + DETACHED_IDLE_MS + 1)
    expect(ids()).toEqual([])
    expect(ptys[0]?.kill).toHaveBeenCalledTimes(1)
  })

  it('clears the idle clock when a client re-attaches before the TTL', () => {
    const first = makeSender()
    const id = create(first)
    detachTerminal(id, first)
    const detachedAt = clock

    clock = detachedAt + DETACHED_IDLE_MS / 2
    vi.setSystemTime(clock)
    expect(attachTerminal(id, makeSender())).not.toBeNull()

    sweepTerminals(detachedAt + DETACHED_IDLE_MS * 2)

    expect(ids()).toEqual([id])
    expect(ptys[0]?.kill).not.toHaveBeenCalled()
  })

  it('starts the idle clock when fanOut drops the last destroyed sender', () => {
    const sender = makeSender()
    const id = create(sender)
    // A socket that died without a close: only the fan-out notices it is gone.
    sender.destroyed = true
    const droppedAt = clock
    ptys[0]?.emitData('output')

    sweepTerminals(droppedAt + DETACHED_IDLE_MS + 1)

    expect(ids()).not.toContain(id)
    expect(ptys[0]?.kill).toHaveBeenCalledTimes(1)
  })

  it('starts the idle clock when a socket close detaches the sender from every session', () => {
    const sender = makeSender()
    const id = create(sender)
    detachSender(sender)
    const detachedAt = clock

    sweepTerminals(detachedAt + DETACHED_IDLE_MS + 1)

    expect(ids()).not.toContain(id)
    expect(ptys[0]?.kill).toHaveBeenCalledTimes(1)
  })
})

describe('MAX_SESSIONS cap', () => {
  it('spends exited sessions before killing anything that is still running', () => {
    const sender = makeSender()
    const filled = Array.from({ length: MAX_SESSIONS }, () => create(sender))
    const exited = filled[0] ?? ''
    ptys[0]?.emitExit(0)
    detachTerminal(exited, sender)

    const fresh = create(sender)

    expect(listTerminals()).toHaveLength(MAX_SESSIONS)
    expect(ids()).toContain(fresh)
    // The exited entry was the sacrifice; every live PTY kept running.
    expect(ids()).not.toContain(exited)
    for (const pty of ptys.slice(1, MAX_SESSIONS)) expect(pty.kill).not.toHaveBeenCalled()
  })

  it('evicts the oldest DETACHED session and spares one with a client attached', () => {
    const watching = makeSender()
    const gone = makeSender()
    // The oldest session is the one being watched, so age alone must not condemn it.
    const attached = create(watching)
    const oldestIdle = create(gone)
    const rest = Array.from({ length: MAX_SESSIONS - 2 }, () => create(gone))
    detachSender(gone)

    const fresh = create(watching)

    expect(listTerminals()).toHaveLength(MAX_SESSIONS)
    expect(ids()).toContain(fresh)
    expect(ids()).toContain(attached)
    expect(ids()).not.toContain(oldestIdle)
    expect(ptys[0]?.kill).not.toHaveBeenCalled()
    expect(ptys[1]?.kill).toHaveBeenCalledTimes(1)
    // Only the single oldest idle session was spent.
    expect(ids()).toEqual(expect.arrayContaining(rest))
  })

  it('refuses rather than killing a session when every one at the cap has a client', () => {
    const sender = makeSender()
    for (let index = 0; index < MAX_SESSIONS; index += 1) create(sender)

    expect(() => create(sender)).toThrow(/all 64 sessions are in use/)

    expect(listTerminals()).toHaveLength(MAX_SESSIONS)
    for (const pty of ptys) expect(pty.kill).not.toHaveBeenCalled()
  })
})

describe('killTerminal', () => {
  it('kills the PTY and never fans out terminal:exit for the removed entry', () => {
    const sender = makeSender()
    const id = create(sender)

    killTerminal(id)
    // The real PTY fires onExit right after kill; the entry is already gone, and a late
    // terminal:exit used to race hydrate and resurface the session as "exited".
    ptys[0]?.emitExit(0)

    expect(ptys[0]?.kill).toHaveBeenCalledTimes(1)
    expect(ids()).toEqual([])
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('fans out terminal:exit for a natural exit', () => {
    const sender = makeSender()
    const id = create(sender)

    ptys[0]?.emitExit(3)

    expect(sender.send).toHaveBeenCalledWith('terminal:exit', id, 3)
    expect(listTerminals()[0]?.exitCode).toBe(3)
  })
})

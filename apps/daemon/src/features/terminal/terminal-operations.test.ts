// @vitest-environment node

import type { TerminalServerFrame } from '@porcelain/contracts/terminal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTerminalOperations,
  DETACHED_IDLE_MS,
  EXITED_RETENTION_MS,
  MAX_SESSIONS,
  QUIET_AFTER_NEWLINE_MS,
  QUIET_AFTER_PROMPT_MS,
} from './terminal-operations'
import type {
  PtyPort,
  PtyProcess,
  TerminalClock,
  TerminalIds,
  TerminalPastePort,
  TerminalStreamSink,
} from './terminal-ports'

type FakePty = PtyProcess & {
  emitData(data: string): void
  emitExit(exitCode: number): void
  writes: ReturnType<typeof vi.fn>
  resizes: ReturnType<typeof vi.fn>
  kills: ReturnType<typeof vi.fn>
}

function makePty(): FakePty {
  let dataListener: ((data: string) => void) | undefined
  let exitListener: ((exitCode: number) => void) | undefined
  const writes = vi.fn()
  const resizes = vi.fn()
  const kills = vi.fn()
  return {
    writes,
    resizes,
    kills,
    write: (data) => writes(data),
    resize: (cols, rows) => resizes(cols, rows),
    kill: () => kills(),
    onData: (listener) => {
      dataListener = listener
    },
    onExit: (listener) => {
      exitListener = listener
    },
    emitData: (data) => dataListener?.(data),
    emitExit: (exitCode) => exitListener?.(exitCode),
  }
}

function makeSink(): TerminalStreamSink & {
  frames: TerminalServerFrame[]
  alive: { value: boolean }
} {
  const alive = { value: true }
  const frames: TerminalServerFrame[] = []
  return { alive, frames, isAlive: () => alive.value, send: (frame) => frames.push(frame) }
}

function makePaste(): TerminalPastePort {
  return {
    save: vi.fn(async (input) => ({
      ok: true as const,
      value: { path: `/daemon/pastes/${input.id}/${input.filename}` },
    })),
    sweep: vi.fn(async () => undefined),
  }
}

function makeIds(): TerminalIds {
  let nextId = 0
  return {
    create: () => `terminal-${++nextId}`,
    epoch: () => 'epoch-1',
  }
}

function makeClock(): TerminalClock {
  return {
    now: () => Date.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeout) => clearTimeout(timeout),
    setInterval: (callback, delay) => setInterval(callback, delay),
  }
}

function makeHarness() {
  const ptys: FakePty[] = []
  const pty: PtyPort = {
    spawn: vi.fn(() => {
      const process = makePty()
      ptys.push(process)
      return process
    }),
  }
  const paste = makePaste()
  const operations = createTerminalOperations({
    pty,
    paste,
    clock: makeClock(),
    ids: makeIds(),
  })
  return { operations, paste, pty, ptys }
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_700_000_000_000 })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Terminal lifecycle operations', () => {
  it('creates with 80x24 defaults, replays scrollback, and sequences fan-out', () => {
    const { operations, pty, ptys } = makeHarness()
    const first = makeSink()
    const second = makeSink()
    const created = operations.create({ name: 'shell', cwd: '/repo' }, first)

    expect(created).toEqual({ ok: true, value: 'terminal-1' })
    expect(pty.spawn).toHaveBeenCalledWith({ cwd: '/repo', cols: 80, rows: 24 })
    ptys[0]?.emitData('hello')

    expect(first.frames).toEqual([
      {
        t: 'terminal:data',
        id: 'terminal-1',
        data: 'hello',
        epoch: 'epoch-1',
        sequence: 1,
      },
    ])
    expect(operations.attach('terminal-1', second)).toEqual({
      ok: true,
      value: {
        id: 'terminal-1',
        scrollback: 'hello',
        status: 'running',
        epoch: 'epoch-1',
        sequence: 1,
      },
    })

    ptys[0]?.emitData(' world')
    expect(first.frames.at(-1)).toEqual(second.frames.at(-1))
    expect(second.frames).toEqual([
      {
        t: 'terminal:data',
        id: 'terminal-1',
        data: ' world',
        epoch: 'epoch-1',
        sequence: 2,
      },
    ])

    ptys[0]?.emitExit(3)
    expect(first.frames.at(-1)).toMatchObject({ t: 'terminal:exit', exitCode: 3, sequence: 3 })
    expect(second.frames.at(-1)).toMatchObject({ t: 'terminal:exit', exitCode: 3, sequence: 3 })
    expect(operations.list()[0]).toMatchObject({ id: 'terminal-1', status: 'exited', exitCode: 3 })
  })

  it('keeps the newest scrollback under the UTF-8 byte cap even for one oversized chunk', () => {
    const { operations, ptys } = makeHarness()
    const first = makeSink()
    const second = makeSink()
    const created = operations.create({ name: 'shell', cwd: '/repo' }, first)
    if (!created.ok) throw new Error('expected a terminal')
    ptys[0]?.emitData('😀'.repeat(40_000))

    const attached = operations.attach(created.value, second)
    if (!attached.ok) throw new Error('expected an attachment')
    expect(Buffer.byteLength(attached.value.scrollback)).toBeLessThanOrEqual(64 * 1024)
    expect(attached.value.scrollback.endsWith('😀')).toBe(true)
  })

  it('returns typed failures, validates geometry, and removes a killed session', () => {
    const { operations, ptys } = makeHarness()
    const sink = makeSink()

    expect(operations.attach('missing', sink)).toEqual({
      ok: false,
      error: { code: 'terminal.not-found' },
    })
    expect(operations.create({ name: 'bad', cwd: '/repo', cols: 0 }, sink)).toEqual({
      ok: false,
      error: { code: 'terminal.invalid-size' },
    })

    const created = operations.create({ name: 'shell', cwd: '/repo' }, sink)
    if (!created.ok) throw new Error('expected a terminal')
    expect(operations.write(created.value, 'input')).toEqual({ ok: true, value: undefined })
    expect(operations.resize(created.value, 120, 40)).toEqual({ ok: true, value: undefined })
    expect(operations.kill(created.value)).toEqual({ ok: true, value: undefined })
    expect(operations.list()).toEqual([])
    expect(operations.write(created.value, 'late')).toEqual({
      ok: false,
      error: { code: 'terminal.not-found' },
    })
    expect(operations.kill('missing')).toEqual({
      ok: false,
      error: { code: 'terminal.not-found' },
    })
    ptys[0]?.emitExit(0)
    ptys[0]?.emitExit(0)
    expect(sink.frames).toEqual([
      { t: 'terminal:exit', id: created.value, exitCode: 0, epoch: 'epoch-1', sequence: 1 },
    ])
  })

  it('fans out the exit to every attached sink when one client kills the session', () => {
    const { operations, ptys } = makeHarness()
    const killer = makeSink()
    const observer = makeSink()
    const created = operations.create({ name: 'shell', cwd: '/repo' }, killer)
    if (!created.ok) throw new Error('expected a terminal')
    expect(operations.attach(created.value, observer).ok).toBe(true)

    expect(operations.kill(created.value)).toEqual({ ok: true, value: undefined })
    expect(ptys[0]?.kills).toHaveBeenCalledOnce()
    ptys[0]?.emitExit(0)

    const exitFrame = {
      t: 'terminal:exit',
      id: created.value,
      exitCode: 0,
      epoch: 'epoch-1',
      sequence: 1,
    }
    expect(observer.frames).toEqual([exitFrame])
    expect(killer.frames).toEqual([exitFrame])
    expect(operations.list()).toEqual([])
  })

  it('reports exited writes and resizes, trims names, and preserves roster shape', () => {
    const { operations, ptys } = makeHarness()
    const sink = makeSink()
    const created = operations.create({ name: ' shell ', cwd: '/repo' }, sink)
    if (!created.ok) throw new Error('expected a terminal')
    operations.rename(created.value, '  renamed  ')
    ptys[0]?.emitExit(1)

    expect(operations.write(created.value, 'input')).toEqual({
      ok: false,
      error: { code: 'terminal.exited' },
    })
    expect(operations.resize(created.value, 80, 24)).toEqual({
      ok: false,
      error: { code: 'terminal.exited' },
    })
    expect(operations.list()).toEqual([
      {
        id: created.value,
        name: 'renamed',
        cwd: '/repo',
        status: 'exited',
        exitCode: 1,
        createdAt: 1_700_000_000_000,
      },
    ])
  })

  it('waits for prompt and newline quiet windows before initial input', () => {
    const { operations, ptys } = makeHarness()
    const first = operations.create(
      { name: 'prompt', cwd: '/repo', initialInput: 'echo hi' },
      makeSink(),
    )
    if (!first.ok) throw new Error('expected a terminal')
    ptys[0]?.emitData('prompt> ')
    vi.advanceTimersByTime(QUIET_AFTER_PROMPT_MS - 1)
    expect(ptys[0]?.writes).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ptys[0]?.writes).toHaveBeenCalledWith('echo hi\r')

    const second = operations.create(
      { name: 'newline', cwd: '/repo', initialInput: 'next' },
      makeSink(),
    )
    if (!second.ok) throw new Error('expected a terminal')
    ptys[1]?.emitData('prompt>\n')
    vi.advanceTimersByTime(QUIET_AFTER_NEWLINE_MS - 1)
    expect(ptys[1]?.writes).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ptys[1]?.writes).toHaveBeenCalledWith('next\r')
  })
})

describe('Terminal retention and capacity policy', () => {
  it('retains exited sessions at the boundary and reaps them after detachment', () => {
    const { operations, ptys } = makeHarness()
    const sink = makeSink()
    const created = operations.create({ name: 'shell', cwd: '/repo' }, sink)
    if (!created.ok) throw new Error('expected a terminal')
    ptys[0]?.emitExit(0)
    operations.detach(created.value, sink)

    operations.sweep(1_700_000_000_000 + EXITED_RETENTION_MS)
    expect(operations.list()).toHaveLength(1)
    operations.sweep(1_700_000_000_000 + EXITED_RETENTION_MS + 1)
    expect(operations.list()).toEqual([])
  })

  it('kills a detached running session after the idle window and ignores dead sinks', () => {
    const { operations, ptys } = makeHarness()
    const sink = makeSink()
    const created = operations.create({ name: 'server', cwd: '/repo' }, sink)
    if (!created.ok) throw new Error('expected a terminal')
    sink.alive.value = false
    ptys[0]?.emitData('late output')

    operations.sweep(1_700_000_000_000 + DETACHED_IDLE_MS)
    expect(operations.list()).toHaveLength(1)
    operations.sweep(1_700_000_000_000 + DETACHED_IDLE_MS + 1)
    expect(operations.list()).toEqual([])
    expect(ptys[0]?.kills).toHaveBeenCalledOnce()
  })

  it('refuses a full set of attached sessions and evicts the oldest detached one', () => {
    const { operations, pty, ptys } = makeHarness()
    const attached = makeSink()
    for (let index = 0; index < MAX_SESSIONS; index += 1) {
      expect(operations.create({ name: `shell-${index}`, cwd: '/repo' }, attached).ok).toBe(true)
    }
    expect(operations.create({ name: 'refused', cwd: '/repo' }, attached)).toEqual({
      ok: false,
      error: { code: 'terminal.capacity' },
    })
    expect(pty.spawn).toHaveBeenCalledTimes(MAX_SESSIONS)

    operations.detach('terminal-1', attached)
    const fresh = operations.create({ name: 'fresh', cwd: '/repo' }, attached)
    expect(fresh.ok).toBe(true)
    expect(operations.list()).toHaveLength(MAX_SESSIONS)
    expect(ptys[0]?.kills).toHaveBeenCalledOnce()
  })
})

describe('Retained sessions (the development-server lifetime)', () => {
  function makeObserver() {
    const commandSent = vi.fn()
    const data = vi.fn()
    const exits = vi.fn()
    return {
      observer: { onCommandSent: commandSent, onData: data, onExit: exits },
      commandSent,
      data,
      exits,
    }
  }

  it('spawns with nobody attached and reports output and exit to its owner', () => {
    const { operations, ptys } = makeHarness()
    const { observer, data, exits } = makeObserver()

    const created = operations.createRetained({ name: 'web', cwd: '/repo' }, observer)
    if (!created.ok) throw new Error('expected a retained session')
    ptys[0]?.emitData('listening')
    ptys[0]?.emitExit(3)

    expect(data).toHaveBeenCalledWith('listening')
    expect(exits).toHaveBeenCalledWith(3)
  })

  it('tells its owner when the command actually reached the shell', () => {
    const { operations, ptys } = makeHarness()
    const { observer, commandSent } = makeObserver()

    operations.createRetained({ name: 'web', cwd: '/repo', initialInput: 'pnpm dev' }, observer)
    ptys[0]?.emitData('$ ')
    vi.advanceTimersByTime(QUIET_AFTER_PROMPT_MS)

    expect(ptys[0]?.writes).toHaveBeenCalledWith('pnpm dev\r')
    expect(commandSent).toHaveBeenCalledOnce()
  })

  it('is never reaped by the detached-idle window an ordinary shell obeys', () => {
    const { operations, ptys } = makeHarness()
    operations.createRetained({ name: 'web', cwd: '/repo' }, makeObserver().observer)

    operations.sweep(1_700_000_000_000 + DETACHED_IDLE_MS * 10)

    expect(operations.list()).toHaveLength(1)
    expect(ptys[0]?.kills).not.toHaveBeenCalled()
  })

  it('keeps a retained session past the exited-retention window so its output survives', () => {
    const { operations, ptys } = makeHarness()
    operations.createRetained({ name: 'web', cwd: '/repo' }, makeObserver().observer)
    ptys[0]?.emitExit(1)

    operations.sweep(1_700_000_000_000 + EXITED_RETENTION_MS * 10)

    expect(operations.list()).toHaveLength(1)
  })

  it('is never the session evicted to make room for a new one', () => {
    const { operations, ptys } = makeHarness()
    const detached = makeSink()
    operations.createRetained({ name: 'web', cwd: '/repo' }, makeObserver().observer)
    for (let index = 0; index < MAX_SESSIONS - 1; index += 1) {
      operations.create({ name: `shell-${index}`, cwd: '/repo' }, detached)
    }
    operations.detachSink(detached)

    const fresh = operations.create({ name: 'fresh', cwd: '/repo' }, makeSink())

    expect(fresh.ok).toBe(true)
    expect(ptys[0]?.kills).not.toHaveBeenCalled()
    expect(ptys[1]?.kills).toHaveBeenCalledOnce()
  })

  it('still ends on an explicit kill — stop is the one thing that reaches it', () => {
    const { operations, ptys } = makeHarness()
    const created = operations.createRetained(
      { name: 'web', cwd: '/repo' },
      makeObserver().observer,
    )
    if (!created.ok) throw new Error('expected a retained session')

    expect(operations.kill(created.value)).toEqual({ ok: true, value: undefined })
    expect(ptys[0]?.kills).toHaveBeenCalledOnce()
    expect(operations.list()).toEqual([])
  })
})

describe('Terminal paste operations', () => {
  it('uses the image/file caps, prompt references, and upload-only mode', async () => {
    const { operations, paste, ptys } = makeHarness()
    const created = operations.create({ name: 'shell', cwd: '/repo' }, makeSink())
    if (!created.ok) throw new Error('expected a terminal')

    await expect(
      operations.pasteImage({
        id: created.value,
        mime: 'image/png',
        dataBase64: 'YWJj',
      }),
    ).resolves.toMatchObject({ ok: true, value: { result: 'ok' } })
    expect(paste.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.value, maxBytes: 4_194_304 }),
    )
    expect(ptys[0]?.writes).toHaveBeenCalledWith(expect.stringContaining('Analyze this image:'))

    ptys[0]?.writes.mockClear()
    await expect(
      operations.pasteFile({
        id: created.value,
        filename: 'report.pdf',
        mime: 'application/pdf',
        dataBase64: 'YWJj',
        insert: false,
      }),
    ).resolves.toMatchObject({ ok: true, value: { result: 'ok' } })
    expect(paste.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: created.value, maxBytes: 8_388_608 }),
    )
    expect(ptys[0]?.writes).not.toHaveBeenCalled()

    await expect(
      operations.pasteImage({ id: 'missing', mime: 'image/png', dataBase64: 'YWJj' }),
    ).resolves.toEqual({ ok: false, error: { code: 'terminal.not-found' } })
  })
})

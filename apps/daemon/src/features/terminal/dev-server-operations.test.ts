// @vitest-environment node

import type { SessionChange } from '@porcelain/contracts/session'
import { describe, expect, it, vi } from 'vitest'
import { createDevServerOperations, DEV_SERVER_EXITED_RETENTION_MS } from './dev-server-operations'
import type {
  DevServerHost,
  TerminalClock,
  TerminalSessionObserver,
  TerminalStreamFailure,
} from './terminal-ports'

const TARGET = {
  projectId: 'project-1',
  worktreeId: 'worktree-1',
  path: '/repo/main',
} as const

const OTHER_TARGET = {
  projectId: 'project-1',
  worktreeId: 'worktree-2',
  path: '/repo/other',
} as const

function makeHarness(options?: { spawnFailure?: TerminalStreamFailure }) {
  let now = 1_000
  const clock: TerminalClock = {
    now: () => now,
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeout) => clearTimeout(timeout),
    setInterval: (callback, delay) => setInterval(callback, delay),
  }
  const observers: TerminalSessionObserver[] = []
  const spawns: Array<{ name: string; cwd: string; initialInput?: string }> = []
  const kills: string[] = []
  let nextTerminal = 0
  const host: DevServerHost = {
    createRetained: (input, observer) => {
      if (options?.spawnFailure !== undefined) return { ok: false, error: options.spawnFailure }
      spawns.push({ name: input.name, cwd: input.cwd, initialInput: input.initialInput })
      observers.push(observer)
      nextTerminal += 1
      return { ok: true, value: `terminal-${nextTerminal}` }
    },
    kill: (id) => {
      kills.push(id)
      return { ok: true, value: undefined }
    },
  }
  const changes: SessionChange[] = []
  let nextId = 0
  const operations = createDevServerOperations({
    host,
    publish: (change) => changes.push(change),
    clock,
    ids: { create: () => `dev-server-${++nextId}` },
  })
  return {
    operations,
    changes,
    kills,
    observers,
    spawns,
    advance: (ms: number) => {
      now += ms
    },
    at: () => now,
  }
}

function startOk(harness: ReturnType<typeof makeHarness>, label = 'web', command = 'pnpm dev') {
  const result = harness.operations.start({ target: TARGET, label, command })
  if (!result.ok) throw new Error(`expected start to succeed, got ${result.error.code}`)
  return result.value
}

describe('starting a development server', () => {
  it('spawns a retained session in the target checkout and records it as starting', () => {
    const harness = makeHarness()
    const server = startOk(harness)

    expect(harness.spawns).toEqual([{ name: 'web', cwd: '/repo/main', initialInput: 'pnpm dev' }])
    expect(server).toMatchObject({
      id: 'dev-server-1',
      target: TARGET,
      label: 'web',
      command: 'pnpm dev',
      cwd: '/repo/main',
      status: 'starting',
      terminalId: 'terminal-1',
    })
    expect(server.endedAt).toBeUndefined()
  })

  it('rejects a target whose checkout path is not absolute rather than guessing one', () => {
    const harness = makeHarness()

    const result = harness.operations.start({
      target: { ...TARGET, path: 'repo/main' },
      label: 'web',
      command: 'pnpm dev',
    })

    expect(result).toEqual({ ok: false, error: { code: 'terminal.dev-server-target' } })
    expect(harness.spawns).toEqual([])
    expect(harness.operations.list({})).toEqual([])
  })

  it('forwards a session-capacity failure instead of recording a server that never spawned', () => {
    const harness = makeHarness({ spawnFailure: { code: 'terminal.capacity' } })

    const result = harness.operations.start({ target: TARGET, label: 'web', command: 'pnpm dev' })

    expect(result).toEqual({ ok: false, error: { code: 'terminal.capacity' } })
    expect(harness.operations.list({})).toEqual([])
  })

  it('announces the change for the starting server target', () => {
    const harness = makeHarness()
    startOk(harness)

    expect(harness.changes).toEqual([
      {
        kind: 'terminal.dev-servers-changed',
        projectPath: '/repo/main',
        projectId: 'project-1',
        worktreeId: 'worktree-1',
      },
    ])
  })
})

describe('a running development server', () => {
  it('becomes running once the shell actually received the command', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.advance(500)

    harness.observers[0]?.onCommandSent()

    const [row] = harness.operations.list({ target: TARGET })
    expect(row).toMatchObject({ id: server.id, status: 'running', startedAt: 1_500 })
  })

  it('picks up the URL the process prints, once, and keeps serving it on later reads', () => {
    const harness = makeHarness()
    startOk(harness)
    harness.observers[0]?.onCommandSent()

    harness.observers[0]?.onData('  ➜  Local:   http://localhost:5173/\n')
    harness.observers[0]?.onData('  ➜  Network: http://10.0.0.9:5173/\n')

    expect(harness.operations.list({ target: TARGET })[0]?.detectedUrl).toBe(
      'http://localhost:5173/',
    )
  })

  it('survives every client going away — the record is unchanged by detachment', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.observers[0]?.onCommandSent()

    // Nothing here represents a client: detaching, reloading, and closing the window are all
    // client-side events that never reach these operations. The roster answers the same.
    expect(harness.operations.list({ target: TARGET })).toEqual([
      expect.objectContaining({ id: server.id, status: 'running', terminalId: 'terminal-1' }),
    ])
    expect(harness.kills).toEqual([])
  })

  it('lists only the asked-for Worktree, and everything when unfiltered', () => {
    const harness = makeHarness()
    startOk(harness)
    harness.operations.start({ target: OTHER_TARGET, label: 'api', command: 'pnpm api' })

    expect(harness.operations.list({ target: TARGET }).map((row) => row.label)).toEqual(['web'])
    expect(harness.operations.list({ target: OTHER_TARGET }).map((row) => row.label)).toEqual([
      'api',
    ])
    expect(harness.operations.list({}).map((row) => row.label)).toEqual(['web', 'api'])
  })
})

describe('ending a development server', () => {
  it('stop kills the session and marks the record stopped', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.advance(2_000)

    const stopped = harness.operations.stop(server.id)

    expect(stopped).toEqual({
      ok: true,
      value: expect.objectContaining({ status: 'stopped', endedAt: 3_000 }),
    })
    expect(harness.kills).toEqual(['terminal-1'])
  })

  it('keeps a stopped record stopped when the PTY exit arrives afterwards', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.operations.stop(server.id)

    harness.observers[0]?.onExit(143)

    const [row] = harness.operations.list({ target: TARGET })
    expect(row).toMatchObject({ status: 'stopped' })
    expect(row?.exitCode).toBeUndefined()
  })

  it('records the exit code when the process dies on its own, and retains the row', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.advance(60_000)

    harness.observers[0]?.onExit(1)

    expect(harness.operations.list({ target: TARGET })).toEqual([
      expect.objectContaining({ id: server.id, status: 'exited', exitCode: 1, endedAt: 61_000 }),
    ])
  })

  it('stop on an unknown server is a typed not-found, never a silent success', () => {
    const harness = makeHarness()
    expect(harness.operations.stop('dev-server-404')).toEqual({
      ok: false,
      error: { code: 'terminal.dev-server-not-found' },
    })
  })
})

describe('dismissing a finished record', () => {
  it('forgets an exited record and releases its session', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.observers[0]?.onExit(0)

    expect(harness.operations.dismiss(server.id)).toEqual({ ok: true, value: undefined })
    expect(harness.operations.list({ target: TARGET })).toEqual([])
    expect(harness.kills).toEqual(['terminal-1'])
  })

  it('refuses to dismiss a live server, which would orphan its process', () => {
    const harness = makeHarness()
    const server = startOk(harness)

    expect(harness.operations.dismiss(server.id)).toEqual({
      ok: false,
      error: { code: 'terminal.dev-server-running' },
    })
    expect(harness.operations.list({ target: TARGET })).toHaveLength(1)
    expect(harness.kills).toEqual([])
  })

  it('drops a finished record nobody dismissed after the retention window', () => {
    const harness = makeHarness()
    startOk(harness)
    harness.observers[0]?.onExit(0)

    harness.advance(DEV_SERVER_EXITED_RETENTION_MS - 1)
    expect(harness.operations.list({ target: TARGET })).toHaveLength(1)

    harness.advance(2)
    expect(harness.operations.list({ target: TARGET })).toEqual([])
    expect(harness.kills).toEqual(['terminal-1'])
  })

  it('never expires a record that is still running, however long it has run', () => {
    const harness = makeHarness()
    startOk(harness)
    harness.observers[0]?.onCommandSent()

    harness.advance(DEV_SERVER_EXITED_RETENTION_MS * 30)

    expect(harness.operations.list({ target: TARGET })).toHaveLength(1)
    expect(harness.kills).toEqual([])
  })
})

describe('roster freshness signals', () => {
  it('announces every lifetime transition for the owning Worktree', () => {
    const harness = makeHarness()
    const server = startOk(harness)
    harness.changes.length = 0

    harness.observers[0]?.onCommandSent()
    harness.observers[0]?.onData('http://127.0.0.1:8000\n')
    harness.operations.stop(server.id)

    expect(harness.changes).toHaveLength(3)
    expect(new Set(harness.changes.map((change) => change.kind))).toEqual(
      new Set(['terminal.dev-servers-changed']),
    )
  })

  it('does not announce output that carries no URL', () => {
    const harness = makeHarness()
    startOk(harness)
    harness.changes.length = 0

    harness.observers[0]?.onData('compiled 42 modules\n')

    expect(harness.changes).toEqual([])
  })
})

describe('the narrow host seam', () => {
  it('asks the session machinery for a retained session, never a plain one', () => {
    const createRetained = vi.fn(() => ({ ok: true as const, value: 'terminal-9' }))
    const operations = createDevServerOperations({
      host: { createRetained, kill: () => ({ ok: true as const, value: undefined }) },
      publish: () => {},
      clock: {
        now: () => 0,
        setTimeout: (callback, delay) => setTimeout(callback, delay),
        clearTimeout: (timeout) => clearTimeout(timeout),
        setInterval: (callback, delay) => setInterval(callback, delay),
      },
      ids: { create: () => 'dev-server-1' },
    })

    operations.start({ target: TARGET, label: 'web', command: 'pnpm dev' })

    expect(createRetained).toHaveBeenCalledTimes(1)
    expect(operations.list({})[0]?.terminalId).toBe('terminal-9')
  })
})

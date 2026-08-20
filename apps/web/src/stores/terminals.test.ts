import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetTerminalTombstonesForTests,
  type TerminalSession,
  useTerminalsStore,
} from './terminals'

// The store writes renames through the vanilla tRPC client (daemon owns the
// roster). Unmocked, each rename fires a REAL fetch at jsdom's localhost:3000
// origin whose rejection can escape test teardown as a vitest unhandled error
// (it did, intermittently, under load — a flaky gate). No store test may touch
// the network. close() reaches the Terminal feature adapter + dispose + tabs; mock those.
const killTerminal = vi.fn()
const detachTerminal = vi.fn()
vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: { renameTerminal: { mutate: vi.fn().mockResolvedValue(undefined) } },
}))
vi.mock('@renderer/lib/local-daemon', () => ({
  forgetTerminalSession: vi.fn(),
  forgetLocalTerminal: vi.fn(),
  localDaemonClient: vi.fn(() => null),
  localDaemonSession: vi.fn(() => null),
  markLocalTerminal: vi.fn(),
  terminalClientFor: vi.fn(() => ({ renameTerminal: { mutate: vi.fn() } })),
}))
vi.mock('@renderer/features/terminal', () => ({
  terminalAdapterFor: vi.fn(() => ({ killTerminal, detachTerminal })),
  terminalAdapterForSession: vi.fn(() => ({
    createTerminal: vi.fn(async () => 'created-id'),
  })),
  renameTerminalOnDaemon: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@renderer/lib/terminal-registry', () => ({
  disposeTerminal: vi.fn(),
}))
vi.mock('@renderer/lib/daemon', () => ({
  primary: {},
}))
vi.mock('@renderer/stores/tabs', () => ({
  tabId: (kind: string, key: string) => `${kind}:${key}`,
  useTabsStore: {
    getState: () => ({ closeTabEverywhere: vi.fn() }),
  },
}))

const session = (
  id: string,
  name: string,
  status: 'running' | 'exited' = 'running',
): TerminalSession => ({
  id,
  name,
  cwd: `/repo/${id}`,
  createdAt: 0,
  status,
  origin: 'primary',
})

const seed = (...sessions: TerminalSession[]): void =>
  useTerminalsStore.setState({ sessions, focusedId: null })

const sessions = (): TerminalSession[] => useTerminalsStore.getState().sessions

describe('useTerminalsStore.rename', () => {
  beforeEach(() => {
    seed()
    __resetTerminalTombstonesForTests()
    vi.clearAllMocks()
  })

  it('renames a session by id', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'))
    useTerminalsStore.getState().rename('t1', 'dev server')
    expect(sessions().map((s) => s.name)).toEqual(['dev server', 'bash'])
  })

  it('trims the new name', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('t1', '  build  ')
    expect(sessions()[0]?.name).toBe('build')
  })

  it('ignores an empty (or whitespace-only) name', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('t1', '   ')
    expect(sessions()[0]?.name).toBe('zsh')
  })

  it('is a no-op for an unknown id', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().rename('nope', 'other')
    expect(sessions()).toEqual([session('t1', 'zsh')])
  })
})

describe('useTerminalsStore.close vs hydrate race', () => {
  beforeEach(() => {
    seed()
    __resetTerminalTombstonesForTests()
    vi.clearAllMocks()
  })

  it('drops the row immediately on close', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'))
    useTerminalsStore.getState().close('t1')
    expect(sessions().map((s) => s.id)).toEqual(['t2'])
    expect(killTerminal).toHaveBeenCalledWith('t1')
  })

  it('does not resurrect a closed session when a stale poll hydrates', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'))
    useTerminalsStore.getState().close('t1')
    // Stale terminalSessions snapshot still lists t1 (kill not processed yet).
    useTerminalsStore.getState().hydrate([session('t1', 'zsh', 'exited'), session('t2', 'bash')])
    expect(sessions().map((s) => s.id)).toEqual(['t2'])
  })

  it('does not resurrect a deleted middle tab when an older cache snapshot arrives later', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'), session('t3', 'fish'))
    useTerminalsStore.getState().close('t2')

    // The fresh roster confirms the delete, then an older cached three-session response arrives.
    useTerminalsStore.getState().hydrate([session('t1', 'zsh'), session('t3', 'fish')])
    useTerminalsStore
      .getState()
      .hydrate([session('t1', 'zsh'), session('t2', 'bash'), session('t3', 'fish')])

    expect(sessions().map((s) => s.id)).toEqual(['t1', 't3'])
  })

  it('ignores markExited for a closed id (no EXITED flash after X)', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().close('t1')
    useTerminalsStore.getState().markExited('t1', 0)
    expect(sessions()).toEqual([])
  })

  it('still marks natural exits as exited when the row is open', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().markExited('t1', 0)
    expect(sessions()[0]).toMatchObject({ id: 't1', status: 'exited', exitCode: 0 })
  })

  it('allows a fresh create with a new id after close', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().close('t1')
    useTerminalsStore.getState().hydrate([session('t-new', 'Terminal 2')])
    expect(sessions().map((s) => s.id)).toEqual(['t-new'])
  })
})

describe('useTerminalsStore create vs hydrate race', () => {
  beforeEach(() => {
    seed()
    __resetTerminalTombstonesForTests()
  })

  /**
   * The bug this exists for: opening a terminal in another Worktree typed into the previous
   * one. `create` resolves before any roster knows the PTY exists, so the very next hydrate
   * — built from a snapshot issued BEFORE the create — erased the row, and the surface fell
   * back to the first session it could still see.
   */
  it('holds a just-created row through a roster snapshot that predates it', async () => {
    await useTerminalsStore.getState().create({ cwd: '/repo/new', name: 'Terminal 9' })
    const created = useTerminalsStore.getState().focusedId
    expect(created).not.toBeNull()

    useTerminalsStore.getState().hydrate([session('t1', 'zsh')])

    expect(
      sessions()
        .map((s) => s.id)
        .sort(),
    ).toEqual(['t1', created].sort())
    expect(useTerminalsStore.getState().focusedId).toBe(created)
  })

  it('retires the guard once a roster actually lists the row', async () => {
    await useTerminalsStore.getState().create({ cwd: '/repo/new', name: 'Terminal 9' })
    const created = useTerminalsStore.getState().focusedId ?? ''

    // The daemon agrees the session exists: from here the roster is authoritative again, so
    // a later snapshot that drops it (another window killed it) really does drop it.
    useTerminalsStore.getState().hydrate([{ ...session(created, 'Terminal 9'), cwd: '/repo/new' }])
    useTerminalsStore.getState().hydrate([session('t1', 'zsh')])

    expect(sessions().map((s) => s.id)).toEqual(['t1'])
  })

  it('lets an explicit close beat the guard — a killed row never comes back', async () => {
    await useTerminalsStore.getState().create({ cwd: '/repo/new', name: 'Terminal 9' })
    const created = useTerminalsStore.getState().focusedId ?? ''

    useTerminalsStore.getState().close(created)
    useTerminalsStore.getState().hydrate([session('t1', 'zsh')])

    expect(sessions().map((s) => s.id)).toEqual(['t1'])
    expect(useTerminalsStore.getState().focusedId).toBeNull()
  })
})

describe('useTerminalsStore focus', () => {
  beforeEach(() => {
    seed()
    __resetTerminalTombstonesForTests()
  })

  it('holds an id the roster does not own, so a cross-project row can be shown', () => {
    seed(session('t1', 'zsh'))
    useTerminalsStore.getState().focus('elsewhere-on-this-daemon')
    expect(useTerminalsStore.getState().focusedId).toBe('elsewhere-on-this-daemon')
  })

  it('releases focus when the focused session is killed, and leaves another alone', () => {
    seed(session('t1', 'zsh'), session('t2', 'bash'))
    useTerminalsStore.getState().focus('t1')
    useTerminalsStore.getState().close('t1')
    expect(useTerminalsStore.getState().focusedId).toBeNull()

    useTerminalsStore.getState().focus('t2')
    useTerminalsStore.getState().close('nope')
    expect(useTerminalsStore.getState().focusedId).toBe('t2')
  })
})

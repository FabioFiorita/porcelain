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
  forgetLocalTerminal: vi.fn(),
  localDaemonClient: vi.fn(() => null),
  localDaemonSession: vi.fn(() => null),
  markLocalTerminal: vi.fn(),
}))
vi.mock('@renderer/features/terminal', () => ({
  terminalAdapterFor: vi.fn(() => ({ killTerminal, detachTerminal })),
  terminalAdapterForSession: vi.fn(() => ({ createTerminal: vi.fn() })),
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
  status,
  origin: 'primary',
})

const seed = (...sessions: TerminalSession[]): void => useTerminalsStore.setState({ sessions })

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

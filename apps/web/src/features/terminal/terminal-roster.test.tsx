import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ListenerSet = {
  readonly onData?: (id: string, data: string) => void
  readonly onExit?: (id: string, exitCode: number) => void
  readonly onScrollback?: (id: string, scrollback: string) => void
  readonly onRecovery?: (recovery: unknown) => void
}

const doubles = vi.hoisted(() => {
  // The lifecycle-terminal focus path subscribes to the owning session's change stream.
  let sessionChangeListener: ((change: unknown) => void) | null = null
  const primarySession = {
    name: 'primary-session',
    onChange: (listener: (change: unknown) => void) => {
      sessionChangeListener = listener
      return () => {
        sessionChangeListener = null
      }
    },
    announceChange: (change: unknown) => sessionChangeListener?.(change),
  }
  const localSession = { name: 'local-session' }
  const primaryAdapter = {
    isTerminalAttached: vi.fn((id: string) => id === 'primary-known'),
    attachTerminal: vi.fn(() => Promise.resolve({})),
  }
  const localAdapter = {
    isTerminalAttached: vi.fn(() => false),
    attachTerminal: vi.fn(() => Promise.resolve({})),
  }
  const primaryRoster = {
    data: [
      { id: 'primary-in', name: 'remote', cwd: '/repo', createdAt: 1, status: 'running' as const },
      {
        id: 'primary-nested',
        name: 'nested',
        cwd: '/repo/src',
        createdAt: 2,
        status: 'exited' as const,
        exitCode: 2,
      },
      {
        id: 'primary-out',
        name: 'outside',
        cwd: '/other',
        createdAt: 3,
        status: 'running' as const,
      },
      {
        id: 'primary-known',
        name: 'attached',
        cwd: '/repo/known',
        createdAt: 4,
        status: 'running' as const,
      },
    ],
    refetch: vi.fn(() => Promise.resolve()),
  }
  const terminalState = {
    markExited: vi.fn(),
    hydrate: vi.fn(),
  }
  return {
    primarySession,
    localSession,
    primaryAdapter,
    localAdapter,
    primaryRoster,
    terminalState,
    projectState: { project: { path: '/repo' } },
    localDaemon: { isLocal: false },
    localPath: '/machine/repo',
    localSessions: [
      {
        id: 'local-in',
        name: 'local',
        cwd: '/machine/repo',
        createdAt: 5,
        status: 'running' as const,
      },
    ],
    followTerminal: vi.fn(),
    daemonIdentity: { host: 'primary', version: '0.0.0-test' },
    primaryListeners: undefined as ListenerSet | undefined,
    localListeners: undefined as ListenerSet | undefined,
    useQuery: vi.fn(() => primaryRoster),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(() => Promise.resolve()),
    })),
    terminalAdapterForSession: vi.fn((session: unknown) =>
      session === primarySession ? primaryAdapter : localAdapter,
    ),
    useTerminalStream: vi.fn((session: unknown, listeners: ListenerSet) => {
      if (session === primarySession) {
        doubles.primaryListeners = listeners
        return primaryAdapter
      }
      if (session === localSession) {
        doubles.localListeners = listeners
        return localAdapter
      }
      return null
    }),
  }
})

vi.mock('@renderer/hooks/use-local-terminal', () => ({
  useLocalDaemon: () => doubles.localDaemon,
  useLocalTerminalPath: vi.fn(() => doubles.localPath),
  useLocalTerminalSessions: vi.fn(() => doubles.localSessions),
}))
vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => doubles.daemonIdentity,
}))
vi.mock('@renderer/lib/daemon', () => ({ primary: doubles.primarySession }))
vi.mock('@renderer/lib/local-daemon', () => ({
  registerTerminalSession: vi.fn(),
  resetTerminalSessions: vi.fn(),
  localDaemonSession: () => doubles.localSession,
  markLocalTerminal: vi.fn(),
}))
vi.mock('@renderer/lib/terminal-registry', () => ({
  receiveData: vi.fn(),
  receiveExit: vi.fn(),
  receiveScrollback: vi.fn(),
}))
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      client: { terminalSessions: { query: vi.fn() }, renameTerminal: { mutate: vi.fn() } },
    }),
  },
}))
vi.mock('@renderer/stores/project-selection', () => ({
  useProjectSelectionStore: (selector: (state: typeof doubles.projectState) => unknown) =>
    selector(doubles.projectState),
}))
vi.mock('@renderer/stores/terminals', () => ({
  useTerminalsStore: Object.assign(
    (selector: (state: typeof doubles.terminalState) => unknown) => selector(doubles.terminalState),
    { getState: () => doubles.terminalState },
  ),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: doubles.useQuery,
  useQueryClient: doubles.useQueryClient,
}))
vi.mock('./terminal-stream-adapter', () => ({
  useTerminalStream: doubles.useTerminalStream,
  // The Environment stream is subscribed once, app-wide, by useEnvironmentTerminalStreams;
  // this hook only needs the adapter to attach the open checkout's shells.
  terminalAdapterForSession: doubles.terminalAdapterForSession,
}))
vi.mock('@renderer/lib/terminal-actions', () => ({
  followTerminal: (id: string) => doubles.followTerminal(id),
}))

import { markLocalTerminal } from '@renderer/lib/local-daemon'
import { receiveExit } from '@renderer/lib/terminal-registry'
import { useTerminalRoster } from './terminal-roster'

beforeEach(() => {
  vi.clearAllMocks()
  doubles.primaryListeners = undefined
  doubles.localListeners = undefined
})

describe('useTerminalRoster', () => {
  it('filters the primary project, binds the mapped local roster, hydrates, and attaches gaps', () => {
    renderHook(() => useTerminalRoster())

    expect(doubles.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        refetchInterval: 5000,
        queryKey: [
          { domain: 'terminal', name: 'sessions' },
          { host: 'primary', version: '0.0.0-test' },
        ],
      }),
    )
    // cwd and createdAt ride along: the Terminals board merges these rows into its own
    // daemon-global list, and both grouping and ordering read them.
    expect(doubles.terminalState.hydrate).toHaveBeenCalledWith([
      {
        id: 'primary-in',
        name: 'remote',
        cwd: '/repo',
        createdAt: 1,
        status: 'running',
        exitCode: undefined,
        origin: 'primary',
      },
      {
        id: 'primary-nested',
        name: 'nested',
        cwd: '/repo/src',
        createdAt: 2,
        status: 'exited',
        exitCode: 2,
        origin: 'primary',
      },
      {
        id: 'primary-known',
        name: 'attached',
        cwd: '/repo/known',
        createdAt: 4,
        status: 'running',
        exitCode: undefined,
        origin: 'primary',
      },
      {
        id: 'local-in',
        name: 'local',
        cwd: '/machine/repo',
        createdAt: 5,
        status: 'running',
        exitCode: undefined,
        origin: 'local',
      },
    ])
    expect(markLocalTerminal).toHaveBeenCalledWith('local-in')
    expect(doubles.primaryAdapter.attachTerminal).toHaveBeenCalledWith('primary-in')
    expect(doubles.primaryAdapter.attachTerminal).not.toHaveBeenCalledWith('primary-known')
    expect(doubles.localAdapter.attachTerminal).toHaveBeenCalledWith('local-in')
  })

  it('follows the Worktree lifecycle terminal the daemon announces', () => {
    renderHook(() => useTerminalRoster())
    expect(doubles.followTerminal).not.toHaveBeenCalled()

    act(() => {
      doubles.primarySession.announceChange({
        kind: 'terminal.worktree-script-started',
        role: 'worktree-setup',
        projectId: 'project-1',
        worktreeId: 'worktree-1',
        terminalId: 'primary-in',
      })
    })

    // Setup and dispose run without a click: the panel follows the session, but nothing
    // opens it — see `followTerminal`.
    expect(doubles.followTerminal).toHaveBeenCalledWith('primary-in')
  })

  it('leaves an announced terminal alone until the checkout listing it is open', () => {
    renderHook(() => useTerminalRoster())

    act(() => {
      doubles.primarySession.announceChange({
        kind: 'terminal.worktree-script-started',
        role: 'worktree-setup',
        projectId: 'project-1',
        worktreeId: 'worktree-2',
        // Filtered out of this checkout's roster: revealing it would show nothing.
        terminalId: 'primary-out',
      })
    })

    expect(doubles.followTerminal).not.toHaveBeenCalled()
  })

  /**
   * "This device" is the one stream this hook still owns: every Environment's stream has a
   * single subscriber in useEnvironmentTerminalStreams, and a second one here would write
   * every byte to the Ghostty surface twice.
   */
  it('routes This device stream exits through both the registry and roster store', () => {
    renderHook(() => useTerminalRoster())

    doubles.localListeners?.onExit?.('local-in', 7)

    expect(receiveExit).toHaveBeenCalledWith('local-in', 7)
    expect(doubles.terminalState.markExited).toHaveBeenCalledWith('local-in', 7)
  })

  it('does not subscribe the Environment stream a second time', () => {
    renderHook(() => useTerminalRoster())

    expect(doubles.useTerminalStream).not.toHaveBeenCalledWith(
      doubles.primarySession,
      expect.anything(),
    )
  })
})

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ListenerSet = {
  readonly onData?: (id: string, data: string) => void
  readonly onExit?: (id: string, exitCode: number) => void
  readonly onScrollback?: (id: string, scrollback: string) => void
  readonly onRecovery?: (recovery: unknown) => void
}

const doubles = vi.hoisted(() => {
  const primarySession = { name: 'primary-session' }
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
      { id: 'primary-in', name: 'remote', cwd: '/repo', status: 'running' as const },
      {
        id: 'primary-nested',
        name: 'nested',
        cwd: '/repo/src',
        status: 'exited' as const,
        exitCode: 2,
      },
      { id: 'primary-out', name: 'outside', cwd: '/other', status: 'running' as const },
      { id: 'primary-known', name: 'attached', cwd: '/repo/known', status: 'running' as const },
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
      { id: 'local-in', name: 'local', cwd: '/machine/repo', status: 'running' as const },
    ],
    daemonIdentity: { host: 'primary', version: '0.0.0-test' },
    primaryListeners: undefined as ListenerSet | undefined,
    localListeners: undefined as ListenerSet | undefined,
    useQuery: vi.fn(() => primaryRoster),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: vi.fn(() => Promise.resolve()),
    })),
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
  useTerminalsStore: (selector: (state: typeof doubles.terminalState) => unknown) =>
    selector(doubles.terminalState),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: doubles.useQuery,
  useQueryClient: doubles.useQueryClient,
}))
vi.mock('./terminal-stream-adapter', () => ({
  useTerminalStream: doubles.useTerminalStream,
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
    expect(doubles.terminalState.hydrate).toHaveBeenCalledWith([
      { id: 'primary-in', name: 'remote', status: 'running', origin: 'primary' },
      { id: 'primary-nested', name: 'nested', status: 'exited', exitCode: 2, origin: 'primary' },
      { id: 'primary-known', name: 'attached', status: 'running', origin: 'primary' },
      { id: 'local-in', name: 'local', status: 'running', origin: 'local' },
    ])
    expect(markLocalTerminal).toHaveBeenCalledWith('local-in')
    expect(doubles.primaryAdapter.attachTerminal).toHaveBeenCalledWith('primary-in')
    expect(doubles.primaryAdapter.attachTerminal).not.toHaveBeenCalledWith('primary-known')
    expect(doubles.localAdapter.attachTerminal).toHaveBeenCalledWith('local-in')
  })

  it('routes stream exits through both the registry and roster store', () => {
    renderHook(() => useTerminalRoster())

    doubles.primaryListeners?.onExit?.('primary-in', 7)

    expect(receiveExit).toHaveBeenCalledWith('primary-in', 7)
    expect(doubles.terminalState.markExited).toHaveBeenCalledWith('primary-in', 7)
  })
})

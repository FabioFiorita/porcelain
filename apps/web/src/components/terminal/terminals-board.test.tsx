import type { HubProject } from '@porcelain/contracts/projects'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { TestIds } from '@shared/test-ids'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECTS: HubProject[] = [
  {
    id: 'p-web',
    environmentId: 'env-1',
    name: 'web',
    groupingKey: 'web',
    path: '/code/web',
    worktrees: [
      {
        id: 'w-main',
        projectId: 'p-web',
        path: '/code/web',
        name: 'main',
        branch: 'main',
        isPrimary: true,
      },
    ],
  },
  {
    id: 'p-api',
    environmentId: 'env-1',
    name: 'api',
    groupingKey: 'api',
    path: '/code/api',
    worktrees: [
      {
        id: 'w-api',
        projectId: 'p-api',
        path: '/code/api',
        name: 'main',
        branch: 'main',
        isPrimary: true,
      },
    ],
  },
]

const ENVIRONMENT_ROOT = '/home/fabio'

const SESSIONS: TerminalInfo[] = [
  { id: 't-web', name: 'Terminal 1', cwd: '/code/web/src', status: 'running', createdAt: 1 },
  { id: 't-api', name: 'Terminal 2', cwd: '/code/api', status: 'running', createdAt: 2 },
  { id: 't-home', name: 'herdr', cwd: ENVIRONMENT_ROOT, status: 'running', createdAt: 3 },
]

const doubles = vi.hoisted(() => {
  const primarySession = { name: 'primary-session' }
  return {
    primarySession,
    sessions: [] as unknown[] | undefined,
    adapter: {
      isTerminalAttached: vi.fn(() => false),
      attachTerminal: vi.fn(() => Promise.resolve({})),
      createTerminal: vi.fn(() => Promise.resolve('t-new')),
    },
    invalidateQueries: vi.fn(() => Promise.resolve()),
    storeRows: [] as unknown[],
    focusedId: null as string | null,
    focus: vi.fn((id: string | null) => {
      doubles.focusedId = id
    }),
    close: vi.fn(),
    rename: vi.fn(),
    spawnTerminalAt: vi.fn(async () => 't-new'),
  }
})

vi.mock('@renderer/components/terminal/terminal-view', () => ({
  TerminalView: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`terminal-pane-${sessionId}`} />
  ),
}))
vi.mock('@renderer/features/projects', () => ({
  useHubInventory: () => ({ environment: { id: 'env-1' }, projects: PROJECTS }),
  useProjectDirectories: () => ({
    result: { path: ENVIRONMENT_ROOT },
    error: null,
    isFetching: false,
  }),
}))
vi.mock('@renderer/hooks/use-local-terminal', () => ({
  useLocalDaemon: () => ({ isLocal: true }),
  useLocalTerminalPath: () => null,
}))
vi.mock('@renderer/stores/hub-selection', () => ({
  useHubSelectionStore: (selector: (state: { selection: { kind: string } }) => unknown) =>
    selector({ selection: { kind: 'home' } }),
}))
vi.mock('@renderer/stores/project-selection', () => ({
  useProjectSelectionStore: (selector: (state: { project: null }) => unknown) =>
    selector({ project: null }),
}))
vi.mock('@renderer/stores/terminals', () => ({
  useTerminalsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      sessions: doubles.storeRows,
      focusedId: doubles.focusedId,
      focus: doubles.focus,
      close: doubles.close,
      rename: doubles.rename,
    }),
}))
vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'primary', version: '0.0.0-test' }),
  useEnvironmentName: () => 'beelink',
}))
vi.mock('@renderer/lib/daemon', () => ({ primary: doubles.primarySession }))
vi.mock('@renderer/lib/trpc', () => ({
  trpc: { useUtils: () => ({ client: {} }) },
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: doubles.sessions }),
  useQueryClient: () => ({ invalidateQueries: doubles.invalidateQueries }),
}))
vi.mock('@renderer/features/terminal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@renderer/features/terminal')>()),
  terminalAdapterForSession: () => doubles.adapter,
  terminalAdapterFor: () => doubles.adapter,
  listTerminalSessionsOnDaemon: vi.fn(),
}))
vi.mock('@renderer/lib/terminal-actions', () => ({
  spawnLocalTerminal: vi.fn(),
  spawnTerminalAt: (cwd: string, opts?: { name?: string; initialInput?: string }) =>
    doubles.spawnTerminalAt(cwd, opts),
}))

import { TerminalsBoard } from './terminals-board'

beforeEach(() => {
  vi.clearAllMocks()
  doubles.sessions = SESSIONS
  doubles.storeRows = []
  doubles.focusedId = null
})

describe('TerminalsBoard', () => {
  it('lists every daemon session grouped by project, including ones no Project claims', () => {
    render(<TerminalsBoard />)

    expect(screen.getByTestId(TestIds.terminalsBoardGroup('p-api:w-api'))).toBeTruthy()
    expect(screen.getByTestId(TestIds.terminalsBoardGroup('p-web:w-main'))).toBeTruthy()
    // A shell at the Environment root leads the list under the Environment's own name,
    // instead of falling into the unclaimed bucket.
    expect(screen.getByTestId(TestIds.terminalsBoardGroup('environment'))).toBeTruthy()
    expect(screen.queryByTestId(TestIds.terminalsBoardGroup('elsewhere'))).toBeNull()
    expect(screen.getByTestId(TestIds.terminalsBoardSession('t-home'))).toBeTruthy()
    expect(screen.getByText('beelink')).toBeTruthy()
  })

  it('starts an Environment shell with the multiplexer typed into it, and finds it again', async () => {
    const { rerender } = render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardEnvironmentShell('tmux')))
    await screen.findByTestId(TestIds.terminalsBoardSession('t-api'))
    expect(doubles.spawnTerminalAt).toHaveBeenCalledWith(ENVIRONMENT_ROOT, {
      name: 'tmux',
      initialInput: 'tmux new -A -s porcelain',
    })

    // The row is now on the daemon: the shortcut focuses it instead of starting a second one.
    doubles.sessions = [
      ...SESSIONS,
      { id: 't-tmux', name: 'tmux', cwd: ENVIRONMENT_ROOT, status: 'running', createdAt: 4 },
    ]
    doubles.spawnTerminalAt.mockClear()
    rerender(<TerminalsBoard />)
    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardEnvironmentShell('tmux')))
    expect(doubles.spawnTerminalAt).not.toHaveBeenCalled()
    expect(doubles.focus).toHaveBeenCalledWith('t-tmux')
  })

  it('merges the repo-scoped store rows the daemon-global roster cannot see', () => {
    doubles.storeRows = [
      {
        id: 't-device',
        name: 'This device shell',
        cwd: '/local/clone',
        createdAt: 9,
        status: 'running',
        origin: 'local',
      },
    ]
    render(<TerminalsBoard />)

    expect(screen.getByTestId(TestIds.terminalsBoardSession('t-device'))).toBeTruthy()
  })

  it('drops a killed row immediately, attaching first so the kill frame is minted at all', async () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardClose('t-api')))

    expect(screen.queryByTestId(TestIds.terminalsBoardSession('t-api'))).toBeNull()
    // A row this window never showed is unknown to the terminal stream, and its kill would
    // be dropped on the floor; attaching makes the session real to the client first.
    await vi.waitFor(() => {
      expect(doubles.adapter.attachTerminal).toHaveBeenCalledWith('t-api')
      expect(doubles.close).toHaveBeenCalledWith('t-api')
    })
  })

  it('puts a row back when the kill never goes out', async () => {
    doubles.adapter.attachTerminal.mockRejectedValueOnce(new Error('daemon hiccup'))
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardClose('t-api')))
    expect(screen.queryByTestId(TestIds.terminalsBoardSession('t-api'))).toBeNull()

    // The PTY is still alive and this is the only surface that lists shells, so hiding it
    // on a failed kill would strand it for the life of the window.
    await screen.findByTestId(TestIds.terminalsBoardSession('t-api'))
    expect(doubles.close).not.toHaveBeenCalled()
  })

  it('keeps the focused session while the roster cache is cold', () => {
    doubles.sessions = undefined
    doubles.focusedId = 't-api'
    render(<TerminalsBoard />)

    // A remount after `gcTime` has no rows yet; un-focusing here loses the session the
    // human was watching the moment the board comes back.
    expect(doubles.focus).not.toHaveBeenCalled()
  })

  it('attaches and shows the focused session, and switches on click', () => {
    const { rerender } = render(<TerminalsBoard />)

    // The Environment leads the list, so its shell wins the initial focus. (`focusedId`
    // lives in the store; this double is not reactive, so read it back on a rerender.)
    expect(doubles.focus).toHaveBeenCalledWith('t-home')
    rerender(<TerminalsBoard />)
    expect(screen.getByTestId('terminal-pane-t-home')).toBeTruthy()
    expect(doubles.adapter.attachTerminal).toHaveBeenCalledWith('t-home')

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardSession('t-api')))
    rerender(<TerminalsBoard />)
    expect(screen.getByTestId('terminal-pane-t-api')).toBeTruthy()
    expect(screen.queryByTestId('terminal-pane-t-home')).toBeNull()
    expect(doubles.adapter.attachTerminal).toHaveBeenCalledWith('t-api')
  })

  it('shows several terminals at once in grid mode', () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardGrid))

    expect(screen.getByTestId('terminal-pane-t-web')).toBeTruthy()
    expect(screen.getByTestId('terminal-pane-t-api')).toBeTruthy()
    expect(screen.getByTestId('terminal-pane-t-home')).toBeTruthy()
  })

  it('hides the grid toggle until there is a second shell to put beside the first', () => {
    doubles.sessions = [SESSIONS[0]]
    const { rerender } = render(<TerminalsBoard />)
    expect(screen.queryByTestId(TestIds.terminalsBoardGrid)).toBeNull()

    doubles.sessions = SESSIONS
    rerender(<TerminalsBoard />)
    expect(screen.getByTestId(TestIds.terminalsBoardGrid)).toBeTruthy()
  })

  it('names each Project once and calls its own checkout Root', async () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardNew))
    const root = await screen.findByTestId(TestIds.terminalsBoardNewAt('p-api:w-api'))

    // The Project names the section; the row carries only the checkout's own name, which is
    // what stopped "porcelain · porcelain-work" from being truncated to "porcelain · por…".
    expect(root.textContent).toBe('Root')
    const menu = root.closest('[role="menu"]')
    expect(menu?.textContent).toContain('api')
    expect(menu?.textContent).not.toContain('api · main')
  })

  it('spawns a terminal in the picked Worktree', async () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardNew))
    fireEvent.click(await screen.findByTestId(TestIds.terminalsBoardNewAt('p-api:w-api')))

    expect(doubles.spawnTerminalAt).toHaveBeenCalledWith('/code/api', undefined)
  })

  it('offers the empty state when the daemon has no sessions', () => {
    doubles.sessions = []
    render(<TerminalsBoard />)

    expect(screen.getByTestId(TestIds.terminalsBoardEmpty)).toBeTruthy()
  })
})

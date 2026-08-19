import type { HubProject } from '@porcelain/contracts/projects'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { fireEvent, render, screen } from '@testing-library/react'
import { TestIds } from '@shared/test-ids'
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

const SESSIONS: TerminalInfo[] = [
  { id: 't-web', name: 'Terminal 1', cwd: '/code/web/src', status: 'running', createdAt: 1 },
  { id: 't-api', name: 'Terminal 2', cwd: '/code/api', status: 'running', createdAt: 2 },
  { id: 't-home', name: 'herdr', cwd: '/home/fabio', status: 'running', createdAt: 3 },
]

const doubles = vi.hoisted(() => {
  const primarySession = { name: 'primary-session' }
  return {
    primarySession,
    sessions: [] as unknown[],
    adapter: {
      isTerminalAttached: vi.fn(() => false),
      attachTerminal: vi.fn(() => Promise.resolve({})),
      createTerminal: vi.fn(() => Promise.resolve('t-new')),
    },
    invalidateQueries: vi.fn(() => Promise.resolve()),
  }
})

vi.mock('@renderer/components/terminal/terminal-view', () => ({
  TerminalView: ({ sessionId }: { sessionId: string }) => (
    <div data-testid={`terminal-pane-${sessionId}`} />
  ),
}))
vi.mock('@renderer/features/projects', () => ({
  useHubInventory: () => ({ environment: { id: 'env-1' }, projects: PROJECTS }),
}))
vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'primary', version: '0.0.0-test' }),
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
  listTerminalSessionsOnDaemon: vi.fn(),
}))

import { TerminalsBoard } from './terminals-board'

beforeEach(() => {
  vi.clearAllMocks()
  doubles.sessions = SESSIONS
})

describe('TerminalsBoard', () => {
  it('lists every daemon session grouped by project, including ones no Project claims', () => {
    render(<TerminalsBoard />)

    expect(screen.getByTestId(TestIds.terminalsBoardGroup('p-api:w-api'))).toBeTruthy()
    expect(screen.getByTestId(TestIds.terminalsBoardGroup('p-web:w-main'))).toBeTruthy()
    expect(screen.getByTestId(TestIds.terminalsBoardGroup('elsewhere'))).toBeTruthy()
    expect(screen.getByText('herdr')).toBeTruthy()
  })

  it('attaches and shows the focused session, and switches on click', () => {
    render(<TerminalsBoard />)

    // First row of the grouped list wins the initial focus (api sorts before web).
    expect(screen.getByTestId('terminal-pane-t-api')).toBeTruthy()
    expect(doubles.adapter.attachTerminal).toHaveBeenCalledWith('t-api')

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardSession('t-home')))
    expect(screen.getByTestId('terminal-pane-t-home')).toBeTruthy()
    expect(screen.queryByTestId('terminal-pane-t-api')).toBeNull()
    expect(doubles.adapter.attachTerminal).toHaveBeenCalledWith('t-home')
  })

  it('shows several terminals at once in grid mode', () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardGrid))

    expect(screen.getByTestId('terminal-pane-t-web')).toBeTruthy()
    expect(screen.getByTestId('terminal-pane-t-api')).toBeTruthy()
    expect(screen.getByTestId('terminal-pane-t-home')).toBeTruthy()
  })

  it('spawns a terminal in the picked Worktree without touching the panel roster', async () => {
    render(<TerminalsBoard />)

    fireEvent.click(screen.getByTestId(TestIds.terminalsBoardNew))
    fireEvent.click(await screen.findByTestId(TestIds.terminalsBoardNewAt('p-api:w-api')))

    expect(doubles.adapter.createTerminal).toHaveBeenCalledWith({
      cwd: '/code/api',
      name: 'Terminal 4',
    })
  })

  it('offers the empty state when the daemon has no sessions', () => {
    doubles.sessions = []
    render(<TerminalsBoard />)

    expect(screen.getByTestId(TestIds.terminalsBoardEmpty)).toBeTruthy()
  })
})

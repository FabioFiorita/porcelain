import { SidebarHeaderActionsProvider } from '@renderer/components/shell/sidebar-header-actions'
import {
  useAgentProviders,
  useAgentThreads,
  useCreateAgentThread,
  useDeleteAgentThread,
  useExternalAgentSessions,
  useImportAgentSession,
  useRenameAgentThread,
} from '@renderer/hooks/use-agents'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTabsStore } from '@renderer/stores/tabs'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentList } from './agent-list'

// Repo idiom: mock the domain hooks, never tRPC. The tabs store is real (a row's
// active-tab resolution reads it); the header actions portal into a real slot node.
vi.mock('@renderer/hooks/use-agents', () => ({
  useAgentThreads: vi.fn(),
  useAgentProviders: vi.fn(),
  useCreateAgentThread: vi.fn(),
  useDeleteAgentThread: vi.fn(),
  useRenameAgentThread: vi.fn(),
  useExternalAgentSessions: vi.fn(),
  useImportAgentSession: vi.fn(),
}))

// The worktree hook wraps tRPC; mock it too so the list renders without a query client.
vi.mock('@renderer/hooks/use-worktrees', () => ({
  useAddWorktree: vi.fn(() => vi.fn()),
  useWorktreeInbox: vi.fn(() => []),
}))

// Base UI's menu positioner/scroll-area polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

// The header actions (incl. the split-button dropdown) portal into a context slot —
// without a provider they render nowhere, so seed a real, attached node.
function renderList(): void {
  const slot = document.createElement('div')
  document.body.appendChild(slot)
  render(
    <SidebarHeaderActionsProvider value={slot}>
      <AgentList />
    </SidebarHeaderActionsProvider>,
  )
}

describe('AgentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTabsStore.setState({ panes: [{ tabs: [], activeTabId: null }], activePaneIndex: 0 })
    usePreferencesStore.setState({ sidebarTab: 'agent', archivedAgentThreadIds: [] })
    vi.mocked(useAgentThreads).mockReturnValue([])
    vi.mocked(useAgentProviders).mockReturnValue([])
    vi.mocked(useCreateAgentThread).mockReturnValue({ create: vi.fn(), isPending: false })
    vi.mocked(useDeleteAgentThread).mockReturnValue({ remove: vi.fn(), isPending: false })
    vi.mocked(useRenameAgentThread).mockReturnValue({ rename: vi.fn() })
    vi.mocked(useExternalAgentSessions).mockReturnValue([])
    vi.mocked(useImportAgentSession).mockReturnValue({
      importSession: vi.fn(),
      isPending: false,
    })
    vi.mocked(useWorktreeInbox).mockReturnValue([])
  })

  it('opens the provider menu without throwing (GroupLabel needs a Group)', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Choose provider for new thread' }))
    expect(await screen.findByText('New thread with…')).toBeInTheDocument()
  })

  it('renders the worktree branch chip for a bound thread', () => {
    vi.mocked(useAgentThreads).mockReturnValue([
      {
        id: 't1',
        repoPath: '/repo-worktrees/feature-x',
        title: 'Bound thread',
        provider: 'claude',
        model: 'sonnet',
        mode: 'full',
        status: 'idle',
        worktreeBranch: 'feature/x',
        createdAt: 0,
        updatedAt: 0,
      },
    ])
    renderList()
    // Idle threads live under Recent (Active is live-only).
    fireEvent.click(screen.getByRole('button', { name: 'Recent' }))
    // Worktree branch is on the meta line under the title (not a separate chip title).
    expect(screen.getByText(/feature\/x/)).toBeInTheDocument()
  })

  it('hands off to the Review sidebar when the inbox cue is clicked', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([
      {
        path: '/repo-worktrees/feat',
        branch: 'feature/x',
        changedCount: 2,
        workingThreads: 0,
        idleThreads: 1,
        hasReview: true,
      },
    ])
    renderList()
    fireEvent.click(screen.getByText(/Review inbox/))
    expect(usePreferencesStore.getState().sidebarTab).toBe('feature')
  })

  it('Active shows only live threads; Recent idle; Archived the rest', () => {
    usePreferencesStore.setState({ archivedAgentThreadIds: ['archived-1'] })
    vi.mocked(useAgentThreads).mockReturnValue([
      {
        id: 'live-1',
        repoPath: '/repo',
        title: 'Live turn',
        provider: 'grok',
        model: 'grok-4.5',
        mode: 'full',
        status: 'working',
        createdAt: 3,
        updatedAt: 3,
      },
      {
        id: 'idle-1',
        repoPath: '/repo',
        title: 'Idle continue',
        provider: 'grok',
        model: 'grok-4.5',
        mode: 'full',
        status: 'idle',
        createdAt: 2,
        updatedAt: 2,
      },
      {
        id: 'archived-1',
        repoPath: '/repo',
        title: 'Done forever',
        provider: 'claude',
        model: 'sonnet',
        mode: 'full',
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    renderList()

    // Default filter = Active: live only (idle is NOT "active").
    expect(screen.getByText('Live turn')).toBeInTheDocument()
    expect(screen.queryByText('Idle continue')).not.toBeInTheDocument()
    expect(screen.queryByText('Done forever')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recent' }))
    expect(screen.queryByText('Live turn')).not.toBeInTheDocument()
    expect(screen.getByText('Idle continue')).toBeInTheDocument()
    expect(screen.queryByText('Done forever')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))
    expect(screen.queryByText('Live turn')).not.toBeInTheDocument()
    expect(screen.queryByText('Idle continue')).not.toBeInTheDocument()
    expect(screen.getByText('Done forever')).toBeInTheDocument()
  })
})

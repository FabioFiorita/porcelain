import type { ReviewInboxRow } from '@porcelain/contracts/review'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useGitWorkspace } from '@renderer/features/git'
import { useNewWindow } from '@renderer/hooks/use-new-window'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewInbox } from './review-inbox'

// Shell path: open-in-new-window is hidden when isBrowser is true (jsdom default).
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

// Repo idiom: mock the domain hook, never tRPC.
vi.mock('@renderer/features/git', () => ({
  useGitWorkspace: vi.fn(),
}))
vi.mock('@renderer/hooks/use-new-window', () => ({ useNewWindow: vi.fn() }))

// Base UI's tooltip positioner polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

function row(overrides: Partial<ReviewInboxRow> = {}): ReviewInboxRow {
  return {
    path: '/repo-worktrees/feat',
    branch: 'feature/x',
    changedCount: 3,
    hasReview: false,
    ...overrides,
  }
}

function renderInbox(): void {
  render(
    <SidebarProvider>
      <ReviewInbox />
    </SidebarProvider>,
  )
}

describe('ReviewInbox', () => {
  const switchProject = vi.fn()
  const openWindow = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useProjectSelectionStore.setState({ switchProject })
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
  })

  it('renders nothing when the inbox is empty', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    const { container } = render(
      <SidebarProvider>
        <ReviewInbox />
      </SidebarProvider>,
    )
    expect(screen.queryByText('Review inbox')).not.toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders a row per worktree with its branch and changed count', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [
        row({ branch: 'feature/x', changedCount: 3 }),
        row({ path: '/repo-worktrees/other', branch: 'feature/y', changedCount: 7 }),
      ],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    renderInbox()
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
    expect(screen.getByText('feature/x')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('feature/y')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('marks the row whose Review the agent already pushed', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [
        row({ hasReview: true }),
        row({ path: '/repo-worktrees/other', branch: 'feature/y', hasReview: false }),
      ],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    renderInbox()
    // Only the pushed row carries the cue — a changed-file count alone must not.
    expect(screen.getAllByLabelText('Review pushed')).toHaveLength(1)
  })

  it('switches this window to the worktree when a row is clicked', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [row({ path: '/repo-worktrees/feat' })],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    renderInbox()
    fireEvent.click(screen.getByText('feature/x'))
    expect(switchProject).toHaveBeenCalledWith('/repo-worktrees/feat')
  })

  it('opens a worktree in a new window without switching this one', () => {
    vi.mocked(useGitWorkspace).mockReturnValue({
      branch: 'main',
      branches: [],
      head: undefined,
      inbox: [row({ path: '/repo-worktrees/feat' })],
      refreshBranches: vi.fn().mockResolvedValue(undefined),
      worktrees: [],
    })
    renderInbox()
    fireEvent.click(screen.getByLabelText('Open feature/x in new window'))
    expect(openWindow).toHaveBeenCalledWith('/repo-worktrees/feat')
    expect(switchProject).not.toHaveBeenCalled()
  })
})

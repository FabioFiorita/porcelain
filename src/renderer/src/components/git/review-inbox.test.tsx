import type { InboxRow } from '@backend/git/worktree-inbox'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useNewWindow } from '@renderer/hooks/use-repo'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewInbox } from './review-inbox'

// Shell path: open-in-new-window is hidden when isBrowser is true (jsdom default).
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false }))

// Repo idiom: mock the domain hook, never tRPC.
vi.mock('@renderer/hooks/use-worktrees', () => ({
  useWorktreeInbox: vi.fn(),
}))
vi.mock('@renderer/hooks/use-repo', () => ({ useNewWindow: vi.fn() }))

// Base UI's tooltip positioner polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

function row(overrides: Partial<InboxRow> = {}): InboxRow {
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
  const switchTo = vi.fn()
  const openWindow = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({ switchTo })
    vi.mocked(useNewWindow).mockReturnValue({ openWindow })
  })

  it('renders nothing when the inbox is empty', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([])
    const { container } = render(
      <SidebarProvider>
        <ReviewInbox />
      </SidebarProvider>,
    )
    expect(screen.queryByText('Review inbox')).not.toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders a row per worktree with its branch and changed count', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([
      row({ branch: 'feature/x', changedCount: 3 }),
      row({ path: '/repo-worktrees/other', branch: 'feature/y', changedCount: 7 }),
    ])
    renderInbox()
    expect(screen.getByText('Review inbox')).toBeInTheDocument()
    expect(screen.getByText('feature/x')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('feature/y')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('marks the row whose Review the agent already pushed', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([
      row({ hasReview: true }),
      row({ path: '/repo-worktrees/other', branch: 'feature/y', hasReview: false }),
    ])
    renderInbox()
    // Only the pushed row carries the cue — a changed-file count alone must not.
    expect(screen.getAllByLabelText('Review pushed')).toHaveLength(1)
  })

  it('switches this window to the worktree when a row is clicked', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([row({ path: '/repo-worktrees/feat' })])
    renderInbox()
    fireEvent.click(screen.getByText('feature/x'))
    expect(switchTo).toHaveBeenCalledWith('/repo-worktrees/feat')
  })

  it('opens a worktree in a new window without switching this one', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([row({ path: '/repo-worktrees/feat' })])
    renderInbox()
    fireEvent.click(screen.getByLabelText('Open feature/x in new window'))
    expect(openWindow).toHaveBeenCalledWith('/repo-worktrees/feat')
    expect(switchTo).not.toHaveBeenCalled()
  })
})

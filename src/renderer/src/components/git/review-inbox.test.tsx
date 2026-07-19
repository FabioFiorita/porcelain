import type { InboxRow } from '@backend/worktree-inbox'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReviewInbox } from './review-inbox'

// Repo idiom: mock the domain hook, never tRPC.
vi.mock('@renderer/hooks/use-worktrees', () => ({
  useWorktreeInbox: vi.fn(),
}))

// Base UI's tooltip positioner polls getAnimations on a timer; jsdom has none.
Element.prototype.getAnimations ??= (): Animation[] => []

function row(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    path: '/repo-worktrees/feat',
    branch: 'feature/x',
    changedCount: 3,
    workingThreads: 0,
    idleThreads: 0,
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

  beforeEach(() => {
    vi.clearAllMocks()
    useRepoStore.setState({ switchTo })
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

  it('shows a working spinner instead of a count while a thread runs', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([row({ workingThreads: 1, changedCount: 2 })])
    renderInbox()
    expect(screen.getByLabelText('Working')).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('switches this window to the worktree when a row is clicked', () => {
    vi.mocked(useWorktreeInbox).mockReturnValue([row({ path: '/repo-worktrees/feat' })])
    renderInbox()
    fireEvent.click(screen.getByText('feature/x'))
    expect(switchTo).toHaveBeenCalledWith('/repo-worktrees/feat')
  })
})

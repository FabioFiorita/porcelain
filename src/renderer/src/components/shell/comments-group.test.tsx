import type { ReviewComment } from '@backend/comment-store'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { useCommentActions, useReviewComments } from '@renderer/hooks/use-comments'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentsGroup } from './comments-group'

// Like the other shell-group tests: mock the domain hook, never tRPC.
vi.mock('@renderer/hooks/use-comments', () => ({
  useReviewComments: vi.fn(),
  useCommentActions: vi.fn(),
}))

const base: ReviewComment = {
  id: 'c1',
  path: 'src/a.ts',
  body: 'why unbounded?',
  resolved: false,
  createdAt: 1,
}

function renderGroup(): void {
  render(
    <SidebarProvider>
      <CommentsGroup />
    </SidebarProvider>,
  )
}

describe('CommentsGroup', () => {
  beforeEach(() => {
    vi.mocked(useCommentActions).mockReturnValue({
      add: vi.fn(),
      edit: vi.fn(),
      remove: vi.fn(),
      setResolved: vi.fn(),
      clearResolved: vi.fn(),
    })
  })

  it("renders the agent's reply under a comment that has one", () => {
    vi.mocked(useReviewComments).mockReturnValue([
      { ...base, agentReply: { body: 'bounded by MAX_RETRIES', createdAt: 2 } },
    ])
    renderGroup()
    expect(screen.getByText('why unbounded?')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('bounded by MAX_RETRIES')).toBeInTheDocument()
  })

  it('renders no Agent label for a comment without a reply', () => {
    vi.mocked(useReviewComments).mockReturnValue([base])
    renderGroup()
    expect(screen.getByText('why unbounded?')).toBeInTheDocument()
    expect(screen.queryByText('Agent')).not.toBeInTheDocument()
  })

  it('hides the clear-closed eraser when nothing is resolved', () => {
    vi.mocked(useReviewComments).mockReturnValue([base])
    renderGroup()
    expect(screen.queryByRole('button', { name: 'Clear closed comments' })).not.toBeInTheDocument()
  })

  it('shows the clear-closed eraser when resolved comments exist', () => {
    vi.mocked(useReviewComments).mockReturnValue([{ ...base, resolved: true }])
    renderGroup()
    expect(screen.getByRole('button', { name: 'Clear closed comments' })).toBeInTheDocument()
  })
})

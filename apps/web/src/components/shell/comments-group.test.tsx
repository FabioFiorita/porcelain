import type { ReviewComment } from '@porcelain/contracts/review'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import {
  COMMENTS,
  defaultCommentHandlers,
  REPO,
  renderComments,
} from '@renderer/features/review/comments/test-support'
import { useRepoStore } from '@renderer/stores/repo'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CommentsGroup } from './comments-group'

const base: ReviewComment = {
  id: 'c1',
  path: 'src/a.ts',
  body: 'why unbounded?',
  resolved: false,
  createdAt: 1,
}

function renderGroup(comments: ReviewComment[]): void {
  useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  renderComments(
    <SidebarProvider>
      <CommentsGroup />
    </SidebarProvider>,
    defaultCommentHandlers({
      reviewComments: () => ({ ok: true, value: comments }),
    }),
  )
}

describe('CommentsGroup', () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  })

  it("renders the agent's reply under a comment that has one", async () => {
    renderGroup([{ ...base, agentReply: { body: 'bounded by MAX_RETRIES', createdAt: 2 } }])
    await waitFor(() => expect(screen.getByText('why unbounded?')).toBeInTheDocument())
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('bounded by MAX_RETRIES')).toBeInTheDocument()
  })

  it('renders no Agent label for a comment without a reply', async () => {
    renderGroup([base])
    await waitFor(() => expect(screen.getByText('why unbounded?')).toBeInTheDocument())
    expect(screen.queryByText('Agent')).not.toBeInTheDocument()
  })

  it('hides the clear-closed eraser when nothing is resolved', async () => {
    renderGroup([base])
    await waitFor(() => expect(screen.getByText('why unbounded?')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Clear closed comments' })).not.toBeInTheDocument()
  })

  it('shows the clear-closed eraser when resolved comments exist', async () => {
    renderGroup([{ ...base, resolved: true }])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Clear closed comments' })).toBeInTheDocument(),
    )
  })

  it('loads fixture comments through the public feature boundary', async () => {
    renderComments(
      <SidebarProvider>
        <CommentsGroup />
      </SidebarProvider>,
    )
    const first = COMMENTS[0]
    if (first === undefined) throw new Error('Expected comments fixture')
    await waitFor(() => expect(screen.getByText(first.body)).toBeInTheDocument())
  })
})

import {
  defaultCommentHandlers,
  renderComments,
  reviewCommentAt,
} from '@renderer/features/review/comments/test-support'
import { TestIds } from '@shared/test-ids'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CommentsManageMenu } from './comments-manage-menu'

const OPEN = reviewCommentAt(0)

describe('CommentsManageMenu', () => {
  it('renders nothing when the worktree has no comments', async () => {
    const { mock } = renderComments(<CommentsManageMenu />, {
      reviewComments: () => ({ ok: true, value: [] }),
    })
    await waitFor(() => {
      expect(mock.requests().some((request) => request.procedure === 'reviewComments')).toBe(true)
    })
    expect(screen.queryByTestId(TestIds.commentsManage)).toBeNull()
  })

  it('resolves every open comment from the Changes header', async () => {
    const { mock } = renderComments(<CommentsManageMenu />)
    await waitFor(() => expect(screen.getByTestId(TestIds.commentsManage)).toBeInTheDocument())

    fireEvent.click(screen.getByTestId(TestIds.commentsManage))
    expect(screen.getByText('1 open · 0 resolved')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(TestIds.commentsResolveAll))

    await waitFor(() => {
      expect(
        mock
          .requests()
          .some(
            (request) =>
              request.procedure === 'resolveReviewComment' &&
              (request.input as { id: string }).id === OPEN.id,
          ),
      ).toBe(true)
    })
  })

  it('clears resolved comments and confirms a wipe of the whole list', async () => {
    const resolved = { ...OPEN, id: 'comment-resolved', resolved: true }
    const { mock } = renderComments(<CommentsManageMenu />, {
      ...defaultCommentHandlers(),
      reviewComments: () => ({ ok: true, value: [OPEN, resolved] }),
      resolveReviewComment: () => ({ ok: true, value: undefined }),
      clearResolvedReviewComments: () => ({ ok: true, value: undefined }),
      deleteReviewComment: () => ({ ok: true, value: undefined }),
    })
    await waitFor(() => expect(screen.getByTestId(TestIds.commentsManage)).toBeInTheDocument())

    fireEvent.click(screen.getByTestId(TestIds.commentsManage))
    expect(screen.getByText('1 open · 1 resolved')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(TestIds.commentsClearResolved))
    await waitFor(() => {
      expect(
        mock.requests().some((request) => request.procedure === 'clearResolvedReviewComments'),
      ).toBe(true)
    })

    fireEvent.click(screen.getByTestId(TestIds.commentsManage))
    fireEvent.click(screen.getByTestId(TestIds.commentsDeleteAll))
    fireEvent.click(screen.getByTestId(TestIds.commentsDeleteAllConfirm))
    await waitFor(() => {
      const deleted = mock
        .requests()
        .filter((request) => request.procedure === 'deleteReviewComment')
        .map((request) => (request.input as { id: string }).id)
      expect(deleted).toEqual(expect.arrayContaining([OPEN.id, resolved.id]))
    })
  })
})

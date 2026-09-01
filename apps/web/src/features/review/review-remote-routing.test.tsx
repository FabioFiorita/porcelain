import { reviewContractFixtures } from '@porcelain/contracts/review'
import { trpcWrapper } from '@renderer/hooks/trpc-test-harness'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({
  owner: null as null | { client: Record<string, unknown>; session: null },
}))

vi.mock('@renderer/hooks/use-hub-owner', () => ({
  useHubRepoOwner: () => ({
    repoPath: reviewContractFixtures.reviewComments.input,
    daemon: { host: 'env-secondary', version: '0.61.4' },
    owner: route.owner,
  }),
  hubOwnerClient: (owner: typeof route.owner) => {
    if (owner === null) throw new Error('The target Environment is offline.')
    return owner.client
  },
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { useReviewedPaths, useToggleReviewed } from '@renderer/features/git/git-reviewed'
import { useCommentActions } from './comments/comment-mutations'
import { useReviewComments } from './comments/comment-queries'

const REPO = reviewContractFixtures.reviewComments.input
const COMMENT = reviewContractFixtures.reviewComments.output[0]
if (COMMENT === undefined) throw new Error('Expected review comment fixture')

function remoteClient() {
  return {
    reviewedPaths: { query: vi.fn(async () => ['src/changed.ts']) },
    setReviewed: { mutate: vi.fn(async () => undefined) },
    reviewComments: { query: vi.fn(async () => [...reviewContractFixtures.reviewComments.output]) },
    addReviewComment: {
      mutate: vi.fn(async () => reviewContractFixtures.addReviewComment.output),
    },
    editReviewComment: { mutate: vi.fn(async () => undefined) },
    deleteReviewComment: { mutate: vi.fn(async () => undefined) },
    resolveReviewComment: { mutate: vi.fn(async () => undefined) },
    clearResolvedReviewComments: { mutate: vi.fn(async () => undefined) },
  }
}

describe('Review owner routing', () => {
  beforeEach(() => {
    route.owner = null
  })

  it('routes all eight Review procedures to the selected secondary Environment', async () => {
    const remote = remoteClient()
    route.owner = { client: remote, session: null }
    const primaryRequests: string[] = []
    const wrapper = trpcWrapper(async (operation) => {
      primaryRequests.push(operation.path)
      throw new Error(`primary client must not receive ${operation.path}`)
    })

    const hook = renderHook(
      () => ({
        comments: useReviewComments(),
        commentActions: useCommentActions(),
        reviewed: useReviewedPaths(),
        toggle: useToggleReviewed(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(hook.result.current.reviewed).toEqual(new Set(['src/changed.ts'])))
    await waitFor(() => expect(hook.result.current.comments).toHaveLength(1))

    act(() => hook.result.current.toggle.mark('src/changed.ts'))
    await waitFor(() => expect(remote.setReviewed.mutate).toHaveBeenCalledTimes(1))
    act(() => hook.result.current.toggle.unmark('src/changed.ts'))
    await waitFor(() => expect(remote.setReviewed.mutate).toHaveBeenCalledTimes(2))

    await act(async () => {
      await hook.result.current.commentActions.add({ path: 'src/changed.ts', body: 'Review this' })
      await hook.result.current.commentActions.edit(COMMENT.id, 'Updated')
      await hook.result.current.commentActions.setResolved(COMMENT.id, true)
      await hook.result.current.commentActions.remove(COMMENT.id)
      await hook.result.current.commentActions.clearResolved()
    })

    expect(remote.reviewedPaths.query).toHaveBeenCalledWith(REPO)
    expect(remote.setReviewed.mutate).toHaveBeenNthCalledWith(1, {
      repoPath: REPO,
      paths: ['src/changed.ts'],
      reviewed: true,
    })
    expect(remote.setReviewed.mutate).toHaveBeenNthCalledWith(2, {
      repoPath: REPO,
      paths: ['src/changed.ts'],
      reviewed: false,
    })
    expect(remote.reviewComments.query).toHaveBeenCalledWith(REPO)
    expect(remote.addReviewComment.mutate).toHaveBeenCalledOnce()
    expect(remote.editReviewComment.mutate).toHaveBeenCalledOnce()
    expect(remote.resolveReviewComment.mutate).toHaveBeenCalledOnce()
    expect(remote.deleteReviewComment.mutate).toHaveBeenCalledOnce()
    expect(remote.clearResolvedReviewComments.mutate).toHaveBeenCalledOnce()
    expect(primaryRequests).toEqual([])
  })

  it('refuses an unavailable secondary Environment without falling back to primary', async () => {
    const primaryRequests: string[] = []
    const wrapper = trpcWrapper(async (operation) => {
      primaryRequests.push(operation.path)
      throw new Error(`primary client must not receive ${operation.path}`)
    })
    const hook = renderHook(() => useCommentActions(), { wrapper })

    await expect(
      hook.result.current.add({ path: 'src/changed.ts', body: 'Review this' }),
    ).rejects.toThrow('target Environment is offline')
    expect(primaryRequests).toEqual([])
  })
})

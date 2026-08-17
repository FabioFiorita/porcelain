import { reviewCommentsQuery } from '@porcelain/client-runtime/review'
import { reviewNotificationFixtures } from '@porcelain/contracts/review'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyReviewCommentNotification } from './comment-notifications'
import { reviewCommentsQueryKey } from './comment-query-key'

const PROJECT = reviewNotificationFixtures['review.changed'].projectPath
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('applyReviewCommentNotification', () => {
  it('invalidates only the Project comments identity for a valid review.changed', () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(PROJECT))
    const otherKey = reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(OTHER))

    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyReviewCommentNotification(reviewNotificationFixtures['review.changed'], {
      queryClient,
      daemon: DAEMON,
    })

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: projectKey,
      exact: true,
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: otherKey,
      exact: true,
    })
  })

  it('leaves another Project comments cache untouched', () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(PROJECT))
    const otherKey = reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(OTHER))
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyReviewCommentNotification(
      { kind: 'review.changed', projectPath: OTHER },
      { queryClient, daemon: DAEMON },
    )

    expect(queryClient.getQueryData(projectKey)).toEqual(['project'])
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })
})

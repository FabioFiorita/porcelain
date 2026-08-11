import { reviewCommentsQuery } from '@porcelain/client-runtime/review'
import { reviewNotificationFixtures } from '@porcelain/contracts/review'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  applyReviewCommentFreshnessRequirement,
  applyReviewCommentNotification,
  invalidateAllReviewComments,
} from './comment-notifications'
import { reviewCommentsQueryKey } from './comment-query-key'

const ENV_ID = 'env-comments-test'
const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'

describe('applyReviewCommentNotification', () => {
  it('invalidates only the matching environment/Project comments query', () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(ENV_ID, PROJECT)
    const otherKey = reviewCommentsQueryKey(ENV_ID, OTHER)

    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyReviewCommentNotification(reviewNotificationFixtures['review.changed'], {
      queryClient,
      environmentId: ENV_ID,
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
    expect(reviewCommentsQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'comments',
      projectPath: PROJECT,
    })
  })

  it('leaves another Project comments cache untouched', () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(ENV_ID, PROJECT)
    const otherKey = reviewCommentsQueryKey(ENV_ID, OTHER)
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyReviewCommentNotification(
      { kind: 'review.changed', projectPath: OTHER },
      { queryClient, environmentId: ENV_ID },
    )

    expect(queryClient.getQueryData(projectKey)).toEqual(['project'])
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })

  it('recovers the exact Project comments after a sequence gap', () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(ENV_ID, PROJECT)
    const otherKey = reviewCommentsQueryKey(ENV_ID, OTHER)
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyReviewCommentFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { queryClient, environmentId: ENV_ID },
    )

    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })

  it('invalidateAllReviewComments targets only comments identities for the environment', async () => {
    const queryClient = new QueryClient()
    const projectKey = reviewCommentsQueryKey(ENV_ID, PROJECT)
    const otherEnvKey = reviewCommentsQueryKey('other-env', PROJECT)
    const boardKey = ['daemon', ENV_ID, { domain: 'board', name: 'cards', projectPath: PROJECT }]
    // Hostile near-matches the predicate must reject.
    const webShaped = [
      { domain: 'review', name: 'comments', projectPath: PROJECT },
      { host: null, version: null },
    ]
    const extraTuple = [
      'daemon',
      ENV_ID,
      { domain: 'review', name: 'comments', projectPath: PROJECT },
      'extra',
    ]
    const missingProjectPath = ['daemon', ENV_ID, { domain: 'review', name: 'comments' }]

    queryClient.setQueryData(projectKey, ['comments'])
    queryClient.setQueryData(otherEnvKey, ['other-env'])
    queryClient.setQueryData(boardKey, ['board'])
    queryClient.setQueryData(webShaped, ['web'])
    queryClient.setQueryData(extraTuple, ['extra'])
    queryClient.setQueryData(missingProjectPath, ['missing'])

    await invalidateAllReviewComments(queryClient, ENV_ID)

    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherEnvKey)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(boardKey)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(webShaped)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(extraTuple)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(missingProjectPath)?.isInvalidated).toBeFalsy()
  })
})

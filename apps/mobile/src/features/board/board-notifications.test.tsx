import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { boardNotificationFixture } from '@porcelain/contracts/board'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { applyBoardNotification } from './board-notifications'
import { boardCardsQueryKey } from './board-query-key'

const ENV_ID = 'env-board-test'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'

describe('applyBoardNotification', () => {
  it('invalidates only the matching environment/Project cards query', () => {
    const queryClient = new QueryClient()
    const projectKey = boardCardsQueryKey(ENV_ID, PROJECT)
    const otherKey = boardCardsQueryKey(ENV_ID, OTHER)

    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyBoardNotification(boardNotificationFixture(PROJECT), {
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
    expect(boardCardsQuery(PROJECT)).toEqual({
      domain: 'board',
      name: 'cards',
      projectPath: PROJECT,
    })
  })

  it('leaves another Project Board cache untouched', () => {
    const queryClient = new QueryClient()
    const projectKey = boardCardsQueryKey(ENV_ID, PROJECT)
    const otherKey = boardCardsQueryKey(ENV_ID, OTHER)
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyBoardNotification(boardNotificationFixture(OTHER), {
      queryClient,
      environmentId: ENV_ID,
    })

    expect(queryClient.getQueryData(projectKey)).toEqual(['project'])
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })
})

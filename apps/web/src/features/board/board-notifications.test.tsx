import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { boardNotificationFixture } from '@porcelain/contracts/board'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyBoardNotification } from './board-notifications'
import { boardCardsQueryKey } from './board-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('applyBoardNotification', () => {
  it('invalidates only the Project cards identity for a valid board.changed', async () => {
    const queryClient = new QueryClient()
    const projectKey = boardCardsQueryKey(DAEMON, boardCardsQuery(PROJECT))
    const otherKey = boardCardsQueryKey(DAEMON, boardCardsQuery(OTHER))

    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyBoardNotification(boardNotificationFixture(PROJECT), {
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

  it('leaves another Project Board cache untouched', () => {
    const queryClient = new QueryClient()
    const projectKey = boardCardsQueryKey(DAEMON, boardCardsQuery(PROJECT))
    const otherKey = boardCardsQueryKey(DAEMON, boardCardsQuery(OTHER))
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyBoardNotification(boardNotificationFixture(OTHER), {
      queryClient,
      daemon: DAEMON,
    })

    // Data stays until the invalidated query refetches; other Project was never targeted.
    expect(queryClient.getQueryData(projectKey)).toEqual(['project'])
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })
})

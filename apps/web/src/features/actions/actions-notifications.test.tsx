import { actionsNotificationFixtures } from '@porcelain/contracts/actions'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyActionsNotification } from './actions-notifications'
import { actionsListKeyForProject } from './actions-query-key'

const PROJECT = 'proj-alpha'
const OTHER = 'proj-beta'
const DAEMON = { host: 'beelink', version: '0.52.1' }

describe('applyActionsNotification', () => {
  it('invalidates only the project list key for a valid actions.changed', () => {
    const queryClient = new QueryClient()
    const projectKey = actionsListKeyForProject(DAEMON, PROJECT)
    const otherKey = actionsListKeyForProject(DAEMON, OTHER)

    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyActionsNotification(actionsNotificationFixtures['actions.changed'], {
      queryClient,
      daemon: DAEMON,
    })

    // Dual list+trust identities collapse to one list-key invalidation.
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

  it('leaves another project Actions cache untouched', () => {
    const queryClient = new QueryClient()
    const projectKey = actionsListKeyForProject(DAEMON, PROJECT)
    const otherKey = actionsListKeyForProject(DAEMON, OTHER)
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyActionsNotification(
      { kind: 'actions.changed', projectId: OTHER },
      { queryClient, daemon: DAEMON },
    )

    expect(queryClient.getQueryData(projectKey)).toEqual(['project'])
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })
})

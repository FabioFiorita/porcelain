import { actionsNotificationFixtures } from '@porcelain/contracts/actions'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyActionsFreshnessRequirement, applyActionsNotification } from './actions-notifications'
import { actionsListKeyForProject } from './actions-query-key'

const ENV = 'env-actions-notif'
const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'

describe('mobile applyActionsNotification', () => {
  it('invalidates only the matching environment/project list key', () => {
    const queryClient = new QueryClient()
    const projectKey = actionsListKeyForProject(ENV, PROJECT)
    const otherKey = actionsListKeyForProject(ENV, OTHER)
    queryClient.setQueryData(projectKey, [{ id: 'a' }])
    queryClient.setQueryData(otherKey, [{ id: 'b' }])

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    applyActionsNotification(actionsNotificationFixtures['actions.changed'], {
      queryClient,
      environmentId: ENV,
    })

    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: projectKey,
      exact: true,
    })
  })

  it('recovers project Actions after a sequence gap', () => {
    const queryClient = new QueryClient()
    const projectKey = actionsListKeyForProject(ENV, PROJECT)
    const otherKey = actionsListKeyForProject(ENV, OTHER)
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])

    applyActionsFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { queryClient, environmentId: ENV },
    )

    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })
})

import { actionsNotificationFixtures } from '@porcelain/contracts/actions'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyActionsFreshnessRequirement, applyActionsNotification } from './actions-notifications'
import { actionsListKeyForProject } from './actions-query-key'

const ENV = 'env-actions-notif'
const PROJECT = actionsNotificationFixtures['actions.changed'].projectId
const OTHER = 'proj-beta'

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
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()
  })

  it('refetches every Actions list after a sequence gap and leaves other domains alone', () => {
    const queryClient = new QueryClient()
    const projectKey = actionsListKeyForProject(ENV, PROJECT)
    const otherKey = actionsListKeyForProject(ENV, OTHER)
    const boardKey = [
      'daemon',
      ENV,
      { domain: 'board', name: 'cards', projectId: PROJECT },
    ] as const
    queryClient.setQueryData(projectKey, ['project'])
    queryClient.setQueryData(otherKey, ['other'])
    queryClient.setQueryData(boardKey, ['card'])

    // The gap names a checkout path while Actions are keyed by Project id, so no path can
    // pick the stale list — every Actions list this client holds is refetched (#24).
    applyActionsFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: '/synthetic/repo' } },
      { queryClient, environmentId: ENV },
    )

    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(boardKey)?.isInvalidated).toBeFalsy()
  })
})

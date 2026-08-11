import { gitHeadQuery, gitStatusQuery } from '@porcelain/client-runtime/git'
import { gitNotificationFixtures } from '@porcelain/contracts/git'
import { QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => null,
}))
vi.mock('@/lib/daemon/session', () => ({
  subscribeSessionChanges: () => () => {},
}))

import { applyGitFreshnessRequirement, applyGitNotification } from './git-notifications'
import { gitWorkspaceQueryKey } from './git-query-key'

const ENVIRONMENT = 'env-git-test'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Mobile Git notification bridge', () => {
  it('invalidates typed working-tree effects and matching legacy reads only', async () => {
    const queryClient = new QueryClient()
    const semanticHead = gitWorkspaceQueryKey(ENVIRONMENT, gitHeadQuery(PROJECT))
    const semanticStatus = gitWorkspaceQueryKey(ENVIRONMENT, gitStatusQuery(PROJECT))
    const other = gitWorkspaceQueryKey(ENVIRONMENT, gitHeadQuery(OTHER_PROJECT))
    const legacy = ['daemon', ENVIRONMENT, 'gitHead', PROJECT] as const
    queryClient.setQueryData(semanticHead, {})
    queryClient.setQueryData(semanticStatus, [])
    queryClient.setQueryData(other, {})
    queryClient.setQueryData(legacy, {})

    applyGitNotification(gitNotificationFixtures['git.working-tree-changed'], {
      environmentId: ENVIRONMENT,
      queryClient,
    })
    await waitFor(() => expect(queryClient.getQueryState(legacy)?.isInvalidated).toBe(true))

    expect(queryClient.getQueryState(semanticHead)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(semanticStatus)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
  })

  it('recovers one project and invalidates all semantic Git keys for a session', async () => {
    const queryClient = new QueryClient()
    const projectHead = gitWorkspaceQueryKey(ENVIRONMENT, gitHeadQuery(PROJECT))
    const projectStatus = gitWorkspaceQueryKey(ENVIRONMENT, gitStatusQuery(PROJECT))
    const other = gitWorkspaceQueryKey(ENVIRONMENT, gitHeadQuery(OTHER_PROJECT))
    queryClient.setQueryData(projectHead, {})
    queryClient.setQueryData(projectStatus, [])
    queryClient.setQueryData(other, {})

    applyGitFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await Promise.resolve()
    expect(queryClient.getQueryState(projectHead)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(projectStatus)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()

    applyGitFreshnessRequirement(
      { reason: 'daemon-replaced', scope: { kind: 'session' } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await Promise.resolve()
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true)
  })
})

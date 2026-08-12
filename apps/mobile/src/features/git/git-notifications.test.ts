import {
  gitCommitDiffQuery,
  gitCommitMessageQuery,
  gitCommitModelsQuery,
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
} from '@porcelain/client-runtime/git'
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

import {
  applyGitFreshnessRequirement,
  applyGitNotification,
  applyGitReviewNotification,
} from './git-notifications'
import { gitQueryKey } from './git-query-key'

const ENVIRONMENT = 'env-git-test'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

describe('Mobile Git notification bridge', () => {
  it('invalidates the working-tree consequences and never an immutable commit read', async () => {
    const queryClient = new QueryClient()
    const head = gitQueryKey(ENVIRONMENT, gitHeadQuery(PROJECT))
    const status = gitQueryKey(ENVIRONMENT, gitStatusQuery(PROJECT))
    const diff = gitQueryKey(ENVIRONMENT, gitDiffFileQuery(PROJECT, 'src/main.ts'))
    const reading = gitQueryKey(ENVIRONMENT, gitDiffReadingQuery(PROJECT, { type: 'branch' }))
    const commitMessage = gitQueryKey(ENVIRONMENT, gitCommitMessageQuery(PROJECT, 'abc'))
    const commitDiff = gitQueryKey(ENVIRONMENT, gitCommitDiffQuery(PROJECT, 'abc', 'src/main.ts'))
    const other = gitQueryKey(ENVIRONMENT, gitHeadQuery(OTHER_PROJECT))
    for (const key of [head, status, diff, reading, commitMessage, commitDiff, other]) {
      queryClient.setQueryData(key, {})
    }

    applyGitNotification(gitNotificationFixtures['git.working-tree-changed'], {
      environmentId: ENVIRONMENT,
      queryClient,
    })
    await waitFor(() => expect(queryClient.getQueryState(head)?.isInvalidated).toBe(true))

    expect(queryClient.getQueryState(status)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(diff)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(reading)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(commitMessage)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(commitDiff)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
  })

  it('regroups the flows a Review layer change moves, and nothing else', async () => {
    const queryClient = new QueryClient()
    const flow = gitQueryKey(ENVIRONMENT, gitFlowQuery(PROJECT))
    const rangeFlow = gitQueryKey(ENVIRONMENT, gitRangeFlowQuery(PROJECT))
    const reading = gitQueryKey(ENVIRONMENT, gitDiffReadingQuery(PROJECT, { type: 'working' }))
    const head = gitQueryKey(ENVIRONMENT, gitHeadQuery(PROJECT))
    for (const key of [flow, rangeFlow, reading, head]) queryClient.setQueryData(key, {})

    applyGitReviewNotification(
      { kind: 'review.changed', projectPath: PROJECT },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(flow)?.isInvalidated).toBe(true))

    expect(queryClient.getQueryState(rangeFlow)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(reading)?.isInvalidated).toBe(true)
    // Layers regroup files; they do not move HEAD.
    expect(queryClient.getQueryState(head)?.isInvalidated).toBeFalsy()
  })

  it('recovers one project for a gap and every Git identity for a session', async () => {
    const queryClient = new QueryClient()
    const projectHead = gitQueryKey(ENVIRONMENT, gitHeadQuery(PROJECT))
    const other = gitQueryKey(ENVIRONMENT, gitHeadQuery(OTHER_PROJECT))
    const models = gitQueryKey(ENVIRONMENT, gitCommitModelsQuery())
    for (const key of [projectHead, other, models]) queryClient.setQueryData(key, {})

    applyGitFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(projectHead)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()

    applyGitFreshnessRequirement(
      { reason: 'daemon-replaced', scope: { kind: 'session' } },
      { environmentId: ENVIRONMENT, queryClient },
    )
    await waitFor(() => expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(models)?.isInvalidated).toBe(true)
  })
})

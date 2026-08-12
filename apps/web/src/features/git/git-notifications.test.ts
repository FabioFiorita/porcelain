import {
  gitCommitDiffQuery,
  gitCommitMessageQuery,
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitHeadQuery,
  gitStatusQuery,
  reviewedPathsQuery,
} from '@porcelain/client-runtime/git'
import { gitNotificationFixtures } from '@porcelain/contracts/git'
import { QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyGitFreshnessRequirement,
  applyGitNotification,
  applyReviewNotification,
} from './git-notifications'
import { gitQueryKey } from './git-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'other', version: '0.52.1' }
const PROJECT = gitNotificationFixtures['git.working-tree-changed'].projectPath
const OTHER_PROJECT = '/synthetic/other'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Web Git notification bridge', () => {
  it('invalidates the typed working-tree effects without crossing projects', async () => {
    const queryClient = new QueryClient()
    const head = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const status = gitQueryKey(DAEMON, gitStatusQuery(PROJECT))
    const diff = gitQueryKey(DAEMON, gitDiffFileQuery(PROJECT, 'src/a.ts'))
    const reviewed = gitQueryKey(DAEMON, reviewedPathsQuery(PROJECT))
    const otherHead = gitQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    for (const key of [head, status, diff, reviewed, otherHead]) queryClient.setQueryData(key, {})

    applyGitNotification(gitNotificationFixtures['git.working-tree-changed'], {
      daemon: DAEMON,
      queryClient,
    })

    await waitFor(() => expect(queryClient.getQueryState(head)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(status)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(diff)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(reviewed)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherHead)?.isInvalidated).toBeFalsy()
  })

  it('never invalidates an immutable commit identity on a working-tree change', async () => {
    const queryClient = new QueryClient()
    const commitDiff = gitQueryKey(DAEMON, gitCommitDiffQuery(PROJECT, 'abc1234', 'src/a.ts'))
    const commitMessage = gitQueryKey(DAEMON, gitCommitMessageQuery(PROJECT, 'abc1234'))
    const head = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    for (const key of [commitDiff, commitMessage, head]) queryClient.setQueryData(key, {})

    applyGitNotification(gitNotificationFixtures['git.working-tree-changed'], {
      daemon: DAEMON,
      queryClient,
    })

    await waitFor(() => expect(queryClient.getQueryState(head)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(commitDiff)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(commitMessage)?.isInvalidated).toBeFalsy()
  })

  it('maps review.changed onto the Git flow and diff-reading consequences only', async () => {
    const queryClient = new QueryClient()
    const working = gitQueryKey(DAEMON, gitDiffReadingQuery(PROJECT, { type: 'working' }))
    const branch = gitQueryKey(DAEMON, gitDiffReadingQuery(PROJECT, { type: 'branch' }))
    const commitScoped = gitQueryKey(
      DAEMON,
      gitDiffReadingQuery(PROJECT, { hash: 'abc1234', type: 'commit' }),
    )
    const status = gitQueryKey(DAEMON, gitStatusQuery(PROJECT))
    for (const key of [working, branch, commitScoped, status]) queryClient.setQueryData(key, {})

    applyReviewNotification(
      { kind: 'review.changed', projectPath: PROJECT },
      { daemon: DAEMON, queryClient },
    )

    await waitFor(() => expect(queryClient.getQueryState(working)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(branch)?.isInvalidated).toBe(true)
    // A commit's stacked diff is immutable, and Review layers never make gitStatus stale.
    expect(queryClient.getQueryState(commitScoped)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(status)?.isInvalidated).toBeFalsy()
  })

  it('recovers only the project named by a sequence gap', async () => {
    const queryClient = new QueryClient()
    const matching = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const other = gitQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    const otherDaemon = gitQueryKey(OTHER_DAEMON, gitHeadQuery(PROJECT))
    for (const key of [matching, other, otherDaemon]) queryClient.setQueryData(key, {})

    applyGitFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { daemon: DAEMON, queryClient },
    )

    await waitFor(() => expect(queryClient.getQueryState(matching)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherDaemon)?.isInvalidated).toBeFalsy()
  })

  it('recovers every Git identity on a session-scoped requirement', async () => {
    const queryClient = new QueryClient()
    const mine = gitQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const other = gitQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    const foreign = ['files', PROJECT] as const
    for (const key of [mine, other, foreign]) queryClient.setQueryData(key, {})

    applyGitFreshnessRequirement(
      { reason: 'reconnect', scope: { kind: 'session' } },
      { daemon: DAEMON, queryClient },
    )

    await waitFor(() => expect(queryClient.getQueryState(mine)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()
  })
})

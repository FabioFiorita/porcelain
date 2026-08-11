import { gitHeadQuery, gitStatusQuery } from '@porcelain/client-runtime/git'
import { gitNotificationFixtures } from '@porcelain/contracts/git'
import { QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitLegacyUtils } from './git-legacy-cache'
import { applyGitFreshnessRequirement, applyGitNotification } from './git-notifications'
import { gitWorkspaceQueryKey } from './git-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

function invalidator() {
  return { invalidate: vi.fn(async (_input?: unknown): Promise<void> => {}) }
}

function legacyUtils(): GitLegacyUtils {
  return {
    featureReading: invalidator(),
    featureView: invalidator(),
    gitBranches: invalidator(),
    gitCommitConventions: invalidator(),
    gitDiffFile: invalidator(),
    gitFlow: invalidator(),
    gitHead: invalidator(),
    gitLog: invalidator(),
    gitRangeFlow: invalidator(),
    gitStatus: invalidator(),
    gitSuggestions: invalidator(),
    gitWorktrees: invalidator(),
    reviewedPaths: invalidator(),
    worktreeInbox: invalidator(),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('Web Git notification bridge', () => {
  it('invalidates the typed working-tree effects without crossing projects', async () => {
    const queryClient = new QueryClient()
    const utils = legacyUtils()
    const matchingHead = gitWorkspaceQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const otherHead = gitWorkspaceQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    const matchingStatus = gitWorkspaceQueryKey(DAEMON, gitStatusQuery(PROJECT))
    queryClient.setQueryData(matchingHead, {})
    queryClient.setQueryData(otherHead, {})
    queryClient.setQueryData(matchingStatus, [])

    applyGitNotification(gitNotificationFixtures['git.working-tree-changed'], {
      daemon: DAEMON,
      queryClient,
      utils,
    })

    await waitFor(() => expect(queryClient.getQueryState(matchingHead)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(matchingStatus)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherHead)?.isInvalidated).toBeFalsy()
    expect(utils.gitHead.invalidate).toHaveBeenCalledWith(PROJECT)
    expect(utils.gitStatus.invalidate).toHaveBeenCalledWith(PROJECT)
  })

  it('recovers only the project named by a sequence gap', async () => {
    const queryClient = new QueryClient()
    const utils = legacyUtils()
    const matching = gitWorkspaceQueryKey(DAEMON, gitHeadQuery(PROJECT))
    const other = gitWorkspaceQueryKey(DAEMON, gitHeadQuery(OTHER_PROJECT))
    queryClient.setQueryData(matching, {})
    queryClient.setQueryData(other, {})

    applyGitFreshnessRequirement(
      { reason: 'sequence-gap', scope: { kind: 'project', projectPath: PROJECT } },
      { daemon: DAEMON, queryClient, utils },
    )

    await waitFor(() => expect(queryClient.getQueryState(matching)?.isInvalidated).toBe(true))
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(utils.gitHead.invalidate).toHaveBeenCalledWith(PROJECT)
  })
})

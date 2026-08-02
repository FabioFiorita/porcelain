import type { HeadRef } from '@porcelain/contracts'
import type { UseQueryResult } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'

import type { DaemonError } from '@/lib/daemon/errors'
import {
  type CommitConventions,
  type DiffFileResult,
  type DiffHunk,
  type DiffReadingScope,
  diffReadingQuery,
  type FeatureReading,
  type FlowGroup,
  type GitSuggestion,
  gitCommitConventionsQuery,
  gitCommitDiffQuery,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitDiffFileQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitSuggestionsQuery,
  reviewedPathsQuery,
} from '@/lib/daemon/procedures/changes'
import { type FeatureViewSummary, featureViewQuery } from '@/lib/daemon/procedures/review'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

/** A commit hash is immutable and the daemon caches its flow forever, so commit-scoped reads
 *  never go stale and are never polled. */
const FOREVER: number = Number.POSITIVE_INFINITY
/**
 * The `working-tree` app-event only reaches sessions that registered watches (the daemon's
 * `watch:files`), and this client registers none — so the socket is silent when an agent edits
 * the tree on the host, and a poll is the freshness mechanism, not a backstop. Mirrors the
 * desktop's memoized flow poll at a phone-tempered interval; every use is gated on screen focus
 * so a backgrounded tab costs nothing.
 */
const FOCUS_POLL = 5_000

type Query<T> = UseQueryResult<T, DaemonError>

/** Every read below needs a repo; `DaemonGate requires="repo"` keeps the screen off-screen
 *  until there is one, and the empty path only ever exists for the disabled render. */
function useRepoPath(): { path: string; enabled: boolean } {
  const repo = useActiveRepo()
  return { enabled: repo !== null, path: repo?.path ?? '' }
}

export function useWorkingFlow(): Query<FlowGroup[]> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(gitFlowQuery, repo.path, {
    enabled: repo.enabled && focused,
    pollMs: FOCUS_POLL,
  })
}

export function useReviewedPaths(enabled = true): Query<string[]> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(reviewedPathsQuery, repo.path, {
    enabled: repo.enabled && focused && enabled,
    pollMs: FOCUS_POLL,
  })
}

export function useHead(): Query<HeadRef> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(gitHeadQuery, repo.path, {
    enabled: repo.enabled && focused,
    pollMs: FOCUS_POLL,
  })
}

export function useSuggestions(): Query<GitSuggestion[]> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(gitSuggestionsQuery, repo.path, {
    enabled: repo.enabled && focused,
    pollMs: FOCUS_POLL,
  })
}

/** The Changes shell uses the agent-published Review as a contextual destination. */
export function useFeatureViewSummary(): Query<FeatureViewSummary> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(featureViewQuery, repo.path, {
    enabled: repo.enabled && focused,
    pollMs: FOCUS_POLL,
  })
}

export function useCommitConventions(): Query<CommitConventions> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(gitCommitConventionsQuery, repo.path, {
    enabled: repo.enabled && focused,
  })
}

export function useLog(
  limit: number,
): Query<{ hash: string; author: string; date: string; subject: string }[]> {
  const repo = useRepoPath()
  const focused = useIsFocused()
  return useDaemonQuery(
    gitLogQuery,
    { limit, repoPath: repo.path },
    { enabled: repo.enabled && focused, pollMs: FOCUS_POLL },
  )
}

export function useCommitMessage(hash: string): Query<string> {
  const repo = useRepoPath()
  return useDaemonQuery(
    gitCommitMessageQuery,
    { hash, repoPath: repo.path },
    { enabled: repo.enabled, staleTime: FOREVER },
  )
}

/** The flow behind a scope: what the list renders, and what the reading screen weighs before
 *  it fires the heavy `diffReading`. */
export function useScopeFlow(scope: DiffReadingScope): Query<FlowGroup[]> {
  const repo = useRepoPath()
  const working = useDaemonQuery(gitFlowQuery, repo.path, {
    enabled: repo.enabled && scope.type === 'working',
  })
  const commit = useDaemonQuery(
    gitCommitFlowQuery,
    { hash: scope.type === 'commit' ? scope.hash : '', repoPath: repo.path },
    { enabled: repo.enabled && scope.type === 'commit', staleTime: FOREVER },
  )
  return scope.type === 'working' ? working : commit
}

/** The heaviest call this client makes — never prefetched, never polled, and only enabled once
 *  the reading screen has decided the change is small enough (or the human said load anyway). */
export function useDiffReading(scope: DiffReadingScope, enabled: boolean): Query<FeatureReading> {
  const repo = useRepoPath()
  return useDaemonQuery(
    diffReadingQuery,
    { repoPath: repo.path, scope },
    { enabled: repo.enabled && enabled, staleTime: scope.type === 'commit' ? FOREVER : undefined },
  )
}

export function useWorkingFileDiff(filePath: string, enabled: boolean): Query<DiffFileResult> {
  const repo = useRepoPath()
  return useDaemonQuery(
    gitDiffFileQuery,
    { filePath, repoPath: repo.path },
    { enabled: repo.enabled && enabled },
  )
}

export function useCommitFileDiff(
  hash: string,
  filePath: string,
  enabled: boolean,
): Query<DiffHunk[]> {
  const repo = useRepoPath()
  return useDaemonQuery(
    gitCommitDiffQuery,
    { filePath, hash, repoPath: repo.path },
    { enabled: repo.enabled && enabled, staleTime: FOREVER },
  )
}

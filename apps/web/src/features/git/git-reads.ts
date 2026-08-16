import {
  type DiffReadingScope,
  gitCommitConventionsQuery,
  gitCommitDiffQuery,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitCommitModelsQuery,
  gitDiffFileQuery,
  gitDiffQuery,
  gitDiffReadingQuery,
  gitFileLogQuery,
  gitFlowQuery,
  gitLogQuery,
  gitProjectKey,
  gitRangeDiffFileQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from '@porcelain/client-runtime/git'
import type { CommitModelOption } from '@porcelain/contracts'
import type {
  ChangedFile,
  Commit,
  CommitConventions,
  DiffFileResult,
  DiffHunk,
  DiffReadingOutput,
  FlowGroup,
  GitSuggestion,
} from '@porcelain/contracts/git'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { daemonScopeForEnvironment, environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { settleBackground } from '@shared/background'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { invalidateGitEffects } from './git-query-filter'
import { gitQueryKey } from './git-query-key'

/**
 * Web Git read adapter.
 *
 * Every read is one semantic Git identity keyed as `[typed Git query, DaemonScope]`. The polling,
 * `keepPreviousData`, enabled, and immutability rules are the product's, not React Query's:
 * the working tree changes under the agent (3s), HEAD and suggestions follow it (5s), and a
 * branch range or a commit hash never changes once read (`staleTime: Infinity`).
 */

export type { DiffReadingScope }

const DISABLED_PROJECT = '/__porcelain-disabled-git-reads__'

function projectPath(path: string | undefined): string {
  return path === undefined ? DISABLED_PROJECT : gitProjectKey(path)
}

function ownerClient(
  owner: ReturnType<typeof environmentClientFor>,
): NonNullable<ReturnType<typeof environmentClientFor>>['client'] {
  if (owner === null) throw new Error('The target Environment is offline.')
  return owner.client
}

function useGitOwner(): ReturnType<typeof environmentClientFor> {
  const target = useHubRepoTarget()
  const primary = trpc.useUtils().client
  // A missing target is the legacy implicit local Changes surface; only an
  // explicit Environment id is subject to the strict refusal boundary.
  return target === null
    ? { client: primary, session: null }
    : environmentClientFor(target.environmentId, primary)
}

function useGitDaemonScope(): DaemonScope {
  const target = useHubRepoTarget()
  return daemonScopeForEnvironment(target?.environmentId, useDaemonIdentity())
}

/** Working-tree flow. Changes constantly outside the app, so it stays live at a 3s poll. */
export function useGitFlow(): { groups: FlowGroup[] | undefined; refresh: () => Promise<void> } {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const queryClient = useQueryClient()
  const owner = useGitOwner()
  const path = projectPath(repoPath ?? undefined)
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: (): Promise<FlowGroup[]> => ownerClient(owner).gitFlow.query(path),
    queryKey: gitQueryKey(daemon, gitFlowQuery(path)),
    refetchInterval: repoPath === null ? false : 3000,
    staleTime: 0,
  })

  return {
    groups: query.data,
    refresh: async (): Promise<void> => {
      await query.refetch()
      await invalidateGitEffects(queryClient, daemon, [gitDiffQuery(path)])
    },
  }
}

/**
 * The Changes tab's Branch scope: the flow-ordered cumulative diff since the merge-base with the
 * default branch. A committed range is static until the next commit, so — unlike useGitFlow —
 * this does NOT poll; the commit/push effect tables refresh it.
 */
export function useBranchFlow(enabled: boolean): {
  groups: FlowGroup[] | undefined
  base: string | undefined
  refresh: () => Promise<void>
} {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: enabled && repoPath !== null,
    queryFn: () => ownerClient(owner).gitRangeFlow.query(path),
    queryKey: gitQueryKey(daemon, gitRangeFlowQuery(path)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return {
    base: query.data?.base,
    groups: query.data?.groups,
    refresh: async (): Promise<void> => {
      await query.refetch()
    },
  }
}

export function useGitStatus(): ChangedFile[] {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitStatus.query(path),
    queryKey: gitQueryKey(daemon, gitStatusQuery(path)),
    staleTime: 0,
  })
  return query.data ?? []
}

export function useGitSuggestions(): GitSuggestion[] {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitSuggestions.query(path),
    queryKey: gitQueryKey(daemon, gitSuggestionsQuery(path)),
    refetchInterval: repoPath === null ? false : 5000,
    staleTime: 0,
  })
  return query.data ?? []
}

export function useDiffFile(
  filePath: string,
  base?: string,
): {
  hunks: DiffHunk[] | undefined
  status: DiffFileResult['status'] | undefined
  image: DiffFileResult['image']
  binary: boolean
  error: { message: string } | null
} {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const working = useQuery({
    enabled: repoPath !== null && base === undefined,
    queryFn: () => ownerClient(owner).gitDiffFile.query({ repoPath: path, filePath }),
    queryKey: gitQueryKey(daemon, gitDiffFileQuery(path, filePath)),
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const range = useQuery({
    enabled: repoPath !== null && base !== undefined,
    queryFn: () =>
      ownerClient(owner).gitRangeDiffFile.query({ base: base ?? '', filePath, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitRangeDiffFileQuery(path, base ?? '', filePath)),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const active = base === undefined ? working : range
  return {
    binary: active.data?.binary === true,
    error: active.error,
    hunks: active.data?.hunks,
    image: active.data?.image,
    status: active.data?.status,
  }
}

/** Prefetch a file's diff (changes-list hover) so opening the diff tab feels instant. */
export function useDiffFilePrefetch(): (filePath: string, base?: string) => Promise<void> {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const queryClient = useQueryClient()
  const owner = useGitOwner()
  return async (filePath: string, base?: string): Promise<void> => {
    if (repoPath === null) return
    const path = gitProjectKey(repoPath)
    if (base === undefined) {
      await queryClient.prefetchQuery({
        queryFn: () => ownerClient(owner).gitDiffFile.query({ filePath, repoPath: path }),
        queryKey: gitQueryKey(daemon, gitDiffFileQuery(path, filePath)),
        staleTime: 2000,
      })
      return
    }
    await queryClient.prefetchQuery({
      queryFn: () => ownerClient(owner).gitRangeDiffFile.query({ base, filePath, repoPath: path }),
      queryKey: gitQueryKey(daemon, gitRangeDiffFileQuery(path, base, filePath)),
      staleTime: 2000,
    })
  }
}

/**
 * Hover prefetch as the UI actually uses it: nobody awaits a warm-up, and a failed one only means
 * the next open is slower, so the hook owns the disposition and hands the event edge a void call.
 */
export function useDiffFileHoverPrefetch(): (filePath: string, base?: string) => void {
  const prefetch = useDiffFilePrefetch()
  return (filePath: string, base?: string): void => {
    settleBackground(prefetch(filePath, base), 'invalidation')
  }
}

export function useCommitDiff(
  hash: string,
  filePath: string,
): { hunks: DiffHunk[] | undefined; error: { message: string } | null } {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitCommitDiff.query({ filePath, hash, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitCommitDiffQuery(path, hash, filePath)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return { error: query.error, hunks: query.data }
}

/**
 * Continuous stacked-diff reading surface for Changes (working/branch) and History (one commit).
 * `undefined` while loading; empty `groups` when there are no changed files. Working polls like
 * gitFlow; branch/commit are static until the next commit, so they don't burn a 3s poll.
 */
export function useDiffReading(scope: DiffReadingScope): {
  reading: DiffReadingOutput | undefined
  error: { message: string } | null
} {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const live = scope.type === 'working'
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).diffReading.query({ repoPath: path, scope }),
    queryKey: gitQueryKey(daemon, gitDiffReadingQuery(path, scope)),
    refetchInterval: live ? 3000 : false,
    staleTime: live ? 0 : Number.POSITIVE_INFINITY,
  })
  return { error: query.error, reading: query.data }
}

export function useGitLog(limit = 200, enabled = true): Commit[] | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: enabled && repoPath !== null,
    queryFn: () => ownerClient(owner).gitLog.query({ limit, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitLogQuery(path, limit)),
    staleTime: 0,
  })
  return query.data
}

/**
 * Commit history for a single file — the History tab's file timeline. `filePath` is null when no
 * file is open in the viewer, which disables the query. staleTime 0: the timeline should reflect
 * new commits as they land.
 */
export function useFileLog(filePath: string | null, limit = 50): Commit[] | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const activePath = filePath ?? ''
  const query = useQuery({
    enabled: repoPath !== null && filePath !== null,
    queryFn: () =>
      ownerClient(owner).gitFileLog.query({ filePath: activePath, limit, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitFileLogQuery(path, activePath, limit)),
    staleTime: 0,
  })
  return query.data
}

export function useCommitMessage(hash: string): string | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitCommitMessage.query({ hash, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitCommitMessageQuery(path, hash)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return query.data
}

/** Imperatively fetch a commit's full message (subject + body) — for copy actions. */
export function useFetchCommitMessage(): (hash: string) => Promise<string> {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const queryClient = useQueryClient()
  const owner = useGitOwner()
  return (hash: string): Promise<string> => {
    if (repoPath === null) return Promise.resolve('')
    const path = gitProjectKey(repoPath)
    return queryClient.fetchQuery({
      queryFn: () => ownerClient(owner).gitCommitMessage.query({ hash, repoPath: path }),
      queryKey: gitQueryKey(daemon, gitCommitMessageQuery(path, hash)),
      staleTime: Number.POSITIVE_INFINITY,
    })
  }
}

/**
 * Flow-grouped file list for a single historical commit. A commit hash is immutable, so the result
 * never changes: staleTime Infinity, and no poll (unlike the live gitFlow).
 */
export function useCommitFlow(hash: string): { groups: FlowGroup[] | undefined } {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitCommitFlow.query({ hash, repoPath: path }),
    queryKey: gitQueryKey(daemon, gitCommitFlowQuery(path, hash)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return { groups: query.data }
}

export function useCommitConventions(): CommitConventions | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useGitDaemonScope()
  const path = projectPath(repoPath ?? undefined)
  const owner = useGitOwner()
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => ownerClient(owner).gitCommitConventions.query(path),
    queryKey: gitQueryKey(daemon, gitCommitConventionsQuery(path)),
  })
  return query.data
}

/**
 * The commit models the daemon can run. Daemon-scoped (no project dimension) and paired with the
 * preference: when the stored choice is not on the daemon's list, the first model is selected.
 */
export function useCommitModels(): {
  models: CommitModelOption[]
  isLoading: boolean
} {
  const daemon = useGitDaemonScope()
  const owner = useGitOwner()
  const commitModel = usePreferencesStore((state) => state.commitModel)
  const setCommitModel = usePreferencesStore((state) => state.setCommitModel)
  const query = useQuery({
    queryFn: () => ownerClient(owner).commitModels.query(),
    queryKey: gitQueryKey(daemon, gitCommitModelsQuery()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const models = query.data

  useEffect(() => {
    const first = models?.[0]
    if (first !== undefined && !models?.some((model) => model.id === commitModel)) {
      setCommitModel(first.id)
    }
  }, [commitModel, models, setCommitModel])

  return { isLoading: query.isLoading, models: models ?? [] }
}

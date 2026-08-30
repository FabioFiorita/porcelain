import {
  gitCommitConventionsQuery,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitCommitModelsQuery,
  gitFileLogQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from '@porcelain/client-runtime/git'
import type { CommitModelOption } from '@porcelain/contracts'
import type {
  ChangedFile,
  Commit,
  CommitConventions,
  FlowGroup,
  GitHead,
  GitSuggestion,
} from '@porcelain/contracts/git'
import { gitProcedures } from '@porcelain/contracts/git'
import { useCallback } from 'react'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { useGitFetch, useGitQuery, useGitScope } from './use-git-transport'

const flowProcedure = namedContractProcedure('gitFlow', gitProcedures.gitFlow)
const rangeFlowProcedure = namedContractProcedure('gitRangeFlow', gitProcedures.gitRangeFlow)
const statusProcedure = namedContractProcedure('gitStatus', gitProcedures.gitStatus)
const headProcedure = namedContractProcedure('gitHead', gitProcedures.gitHead)
const suggestionsProcedure = namedContractProcedure('gitSuggestions', gitProcedures.gitSuggestions)
const conventionsProcedure = namedContractProcedure(
  'gitCommitConventions',
  gitProcedures.gitCommitConventions,
)
const logProcedure = namedContractProcedure('gitLog', gitProcedures.gitLog)
const fileLogProcedure = namedContractProcedure('gitFileLog', gitProcedures.gitFileLog)
const commitMessageProcedure = namedContractProcedure(
  'gitCommitMessage',
  gitProcedures.gitCommitMessage,
)
const commitFlowProcedure = namedContractProcedure('gitCommitFlow', gitProcedures.gitCommitFlow)
const commitModelsProcedure = namedContractProcedure('commitModels', gitProcedures.commitModels)

/**
 * How often the git suggestion re-reads the refs behind it. Its own identity, read from one
 * card, so no other observer's interval can silently win over it.
 */
const SUGGESTIONS_POLL_MS = 5_000

/**
 * Commits land at human pace, not keystroke pace, so history refreshes far slower than the
 * working tree. It is a poll rather than pure invalidation because the daemon's working-tree
 * push is not a promise of delivery — a commit made while the phone slept must still appear.
 */
const HISTORY_POLL_MS = 15_000

/** How far back the list reads. The daemon caps this at 500. */
const LOG_LIMIT = 200

/** How far back a single file's timeline reads. The daemon caps this at 200. */
const FILE_LOG_LIMIT = 50

/**
 * A commit hash is immutable, so everything keyed by one is read once and never refreshed.
 * That is what lets History open a commit instantly on a second visit.
 */
const IMMUTABLE = Number.POSITIVE_INFINITY

export type GitFlowOptions = {
  readonly enabled?: boolean
  /** Working-tree poll rate when the caller supplies its active surface. */
  readonly pollMs?: number
}

export type GitFlowRead = {
  groups: FlowGroup[] | undefined
  isLoading: boolean
  error: Error | null
}

/** The flow-grouped working tree. */
export function useGitFlow(options: GitFlowOptions = {}): GitFlowRead {
  const scope = useGitScope()
  // A caller without an explicit surface-active value can still read once, but it must not
  // quietly keep a working-tree poll alive after that surface disappears.
  const pollMs = options.enabled === true ? (options.pollMs ?? LIVE_POLL_MS) : undefined
  const { data, error, isLoading } = useGitQuery(
    gitFlowQuery(scope.projectPath),
    flowProcedure,
    scope.repoPath,
    {
      enabled: scope.ready && (options.enabled ?? true),
      keepPreviousData: true,
      pollMs,
      staleTime: 0,
    },
  )
  return { error, groups: data, isLoading }
}

export type GitRangeFlowRead = GitFlowRead & {
  /** The ref the range is measured against. */
  base: string | undefined
  /** The daemon's choice when no explicit base is requested. */
  defaultBase: string | undefined
}

export type GitRangeFlowOptions = GitFlowOptions & { readonly base?: string }

/** The cumulative committed range since the merge-base — static until the next commit. */
export function useGitRangeFlow(options: GitRangeFlowOptions = {}): GitRangeFlowRead {
  const scope = useGitScope()
  const { data, error, isLoading } = useGitQuery(
    gitRangeFlowQuery(scope.projectPath, options.base),
    rangeFlowProcedure,
    { repoPath: scope.repoPath, ...(options.base === undefined ? {} : { base: options.base }) },
    { enabled: scope.ready && (options.enabled ?? true), keepPreviousData: true },
  )
  return {
    base: data?.base,
    defaultBase: data?.defaultBase,
    error,
    groups: data?.groups,
    isLoading,
  }
}

/**
 * The working-tree flow, whatever scope a list is reading.
 *
 * Staging and committing always act on the working tree — a committed range carries no
 * staged/unstaged state at all — so the commit composer reads this rather than the active scope.
 */
export function useWorkingFlow(active: boolean): FlowGroup[] | undefined {
  return useGitFlow({ enabled: active }).groups
}

/** The porcelain status list — staged and unstaged paths without the flow grouping. */
export function useGitStatus(active: boolean): {
  files: ChangedFile[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const scope = useGitScope()
  const { data, error, isLoading } = useGitQuery(
    gitStatusQuery(scope.projectPath),
    statusProcedure,
    scope.repoPath,
    { enabled: scope.ready && active, pollMs: LIVE_POLL_MS, staleTime: 0 },
  )
  return { error, files: data, isLoading }
}

/** The checked-out ref. */
export function useGitHead(active: boolean): {
  head: GitHead | undefined
  isLoading: boolean
  error: Error | null
} {
  const scope = useGitScope()
  const { data, error, isLoading } = useGitQuery(
    gitHeadQuery(scope.projectPath),
    headProcedure,
    scope.repoPath,
    { enabled: scope.ready && active, pollMs: HISTORY_POLL_MS },
  )
  return { error, head: data, isLoading }
}

/** The branch the log belongs to — the list header's context, not a fetch key. */
export function useHeadLabel(active: boolean): string | null {
  const { head } = useGitHead(active)
  if (head === undefined) return null
  return head.branch ?? (head.detachedSha === null ? null : `detached at ${head.detachedSha}`)
}

/**
 * The agent-free heuristic for "the one git command worth running right now" (behind, ahead,
 * stash present, dirty tree). Polled: it is derived from refs the daemon does not watch.
 */
export function useGitSuggestions(active: boolean): GitSuggestion[] {
  const scope = useGitScope()
  const { data } = useGitQuery(
    gitSuggestionsQuery(scope.projectPath),
    suggestionsProcedure,
    scope.repoPath,
    { enabled: scope.ready && active, pollMs: SUGGESTIONS_POLL_MS, staleTime: 0 },
  )
  return data ?? []
}

/** The `type` / `scope` vocabulary this project already uses, mined from its history. */
export function useCommitConventions(): CommitConventions | undefined {
  const scope = useGitScope()
  const { data } = useGitQuery(
    gitCommitConventionsQuery(scope.projectPath),
    conventionsProcedure,
    scope.repoPath,
    { enabled: scope.ready },
  )
  return data
}

export type GitLog = {
  commits: Commit[] | undefined
  isLoading: boolean
  error: Error | null
}

/** Commits on the checked-out branch, newest first. */
export function useGitLog(active: boolean): GitLog {
  const scope = useGitScope()
  const { data, error, isLoading } = useGitQuery(
    gitLogQuery(scope.projectPath, LOG_LIMIT),
    logProcedure,
    { limit: LOG_LIMIT, repoPath: scope.repoPath },
    {
      enabled: scope.ready && active,
      keepPreviousData: true,
      pollMs: HISTORY_POLL_MS,
      staleTime: 0,
    },
  )
  return { commits: data, error, isLoading }
}

/**
 * One file's commit history — the companion's timeline. Disabled when no file is open, since
 * there is no point asking git about an empty path.
 */
export function useFileLog(filePath: string | null, active: boolean): Commit[] | undefined {
  const scope = useGitScope()
  const path = filePath ?? ''
  const { data } = useGitQuery(
    gitFileLogQuery(scope.projectPath, path, FILE_LOG_LIMIT),
    fileLogProcedure,
    { filePath: path, limit: FILE_LOG_LIMIT, repoPath: scope.repoPath },
    { enabled: scope.ready && active && filePath !== null, pollMs: HISTORY_POLL_MS, staleTime: 0 },
  )
  return data
}

/** The commit's raw `%B` — subject and body. */
export function useCommitMessage(hash: string, active: boolean): string | undefined {
  const scope = useGitScope()
  const { data } = useGitQuery(
    gitCommitMessageQuery(scope.projectPath, hash),
    commitMessageProcedure,
    { hash, repoPath: scope.repoPath },
    { enabled: scope.ready && active, staleTime: IMMUTABLE },
  )
  return data
}

/** The same message, imperatively — the row menu's copy action. */
export function useFetchCommitMessage(): (hash: string) => Promise<string> {
  const scope = useGitScope()
  const fetchGit = useGitFetch()
  const { projectPath, ready, repoPath } = scope

  return useCallback(
    (hash: string): Promise<string> => {
      if (!ready) return Promise.resolve('')
      return fetchGit(gitCommitMessageQuery(projectPath, hash), commitMessageProcedure, {
        hash,
        repoPath,
      })
    },
    [fetchGit, projectPath, ready, repoPath],
  )
}

export type CommitFlow = {
  groups: FlowGroup[] | undefined
  isLoading: boolean
  error: Error | null
}

/** The commit's changed files, in the same flow order the Changes list groups by. */
export function useCommitFlow(hash: string, active: boolean): CommitFlow {
  const scope = useGitScope()
  const { data, error, isLoading } = useGitQuery(
    gitCommitFlowQuery(scope.projectPath, hash),
    commitFlowProcedure,
    { hash, repoPath: scope.repoPath },
    { enabled: scope.ready && active, staleTime: IMMUTABLE },
  )
  return { error, groups: data, isLoading }
}

/**
 * The commit-message providers installed on the active daemon. Daemon-scoped: this read has no
 * project dimension, and a project switch must not refetch it.
 */
export function useCommitModels(enabled: boolean): {
  options: readonly CommitModelOption[]
  isLoading: boolean
  error: Error | null
} {
  const { data, error, isLoading } = useGitQuery(
    gitCommitModelsQuery(),
    commitModelsProcedure,
    undefined,
    { enabled },
  )
  return { error, isLoading, options: data ?? [] }
}

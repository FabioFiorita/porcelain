import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import { useActiveProject } from '@/features/projects'
import {
  type Commit,
  type FlowGroup,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitFileLogQuery,
  gitHeadQuery,
  gitLogQuery,
} from '@/lib/daemon/procedures/changes'
import { useDaemonQuery } from '@/lib/daemon/queries'

import { type HistorySelection, useHistoryStore } from './history-store'

/**
 * Commits land at human pace, not keystroke pace, so the log refreshes far slower than the
 * working tree does. It is a poll rather than pure invalidation because the daemon's
 * `working-tree` push is not a promise of delivery — a commit made on the host while the
 * phone was asleep must still show up on the next look.
 */
const HISTORY_POLL_MS = 15_000

/** How far back the list reads. The daemon caps this at 500. */
const LOG_LIMIT = 200

/** How far back a single file's timeline reads. The daemon caps this at 200. */
const FILE_LOG_LIMIT = 50

export type GitLog = {
  commits: Commit[] | undefined
  isLoading: boolean
  error: Error | null
}

/** Commits on the checked-out branch, newest first. */
export function useGitLog(active: boolean): GitLog {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(
    gitLogQuery,
    { limit: LOG_LIMIT, repoPath: project?.path ?? '' },
    {
      enabled: active && project !== null,
      placeholderData: 'keepPreviousData',
      pollMs: HISTORY_POLL_MS,
      staleTime: 0,
    },
  )
  return { commits: data, error, isLoading }
}

/** The branch the log belongs to — the list header's context, not a fetch key. */
export function useHeadLabel(active: boolean): string | null {
  const project = useActiveProject()
  const { data } = useDaemonQuery(gitHeadQuery, project?.path ?? '', {
    enabled: active && project !== null,
    pollMs: HISTORY_POLL_MS,
  })
  if (data === undefined) return null
  return data.branch ?? (data.detachedSha === null ? null : `detached at ${data.detachedSha}`)
}

/**
 * A commit hash is immutable, so everything keyed by one is read once and never refreshed.
 * That is what lets History open a commit instantly on a second visit, and why none of these
 * reads poll — there is nothing that could change under them.
 */
const IMMUTABLE = { staleTime: Number.POSITIVE_INFINITY } as const

/** The commit's raw `%B` — subject and body. */
export function useCommitMessage(hash: string, active: boolean): string | undefined {
  const project = useActiveProject()
  const { data } = useDaemonQuery(
    gitCommitMessageQuery,
    { hash, repoPath: project?.path ?? '' },
    { enabled: active && project !== null, ...IMMUTABLE },
  )
  return data
}

export type CommitFlow = {
  groups: FlowGroup[] | undefined
  isLoading: boolean
  error: Error | null
}

/** The commit's changed files, in the same flow order the Changes list groups by. */
export function useCommitFlow(hash: string, active: boolean): CommitFlow {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(
    gitCommitFlowQuery,
    { hash, repoPath: project?.path ?? '' },
    { enabled: active && project !== null, ...IMMUTABLE },
  )
  return { error, groups: data, isLoading }
}

/**
 * One file's commit history — the companion's timeline. Disabled when no file is open, since
 * there is no point asking git about an empty path.
 */
export function useFileLog(filePath: string | null, active: boolean): Commit[] | undefined {
  const project = useActiveProject()
  const { data } = useDaemonQuery(
    gitFileLogQuery,
    { filePath: filePath ?? '', limit: FILE_LOG_LIMIT, repoPath: project?.path ?? '' },
    {
      enabled: active && project !== null && filePath !== null,
      pollMs: HISTORY_POLL_MS,
      staleTime: 0,
    },
  )
  return data
}

/**
 * Report what this screen is showing into the store while it is focused.
 *
 * The phone reaches these screens by pushing routes, so the store is not driving navigation
 * there — but the companion sheet still has to know which commit and file are being read, and
 * it cannot see into a pushed screen. The tablet's viewer writes the same field directly.
 *
 * Only the detail screens call this. The list deliberately does not reset it: the companion
 * opens from the list's header, so a reset there would empty the very panel it feeds.
 */
export function useHistoryFocus(selection: HistorySelection): void {
  const focused = useIsFocused()
  const hash = selection?.hash ?? null
  const kind = selection?.kind ?? null
  const path = selection !== null && selection.kind === 'file' ? selection.path : null

  useEffect(() => {
    if (!focused) return
    const store = useHistoryStore.getState()
    if (hash === null || kind === null) store.clear()
    else if (kind === 'file' && path !== null) store.openFile(hash, path)
    else if (kind === 'all') store.openAll(hash)
    else store.openCommit(hash)
    // Primitives, not the object: a fresh `{ kind, hash }` every render would re-run this
    // effect on every render and fight the store it writes to.
  }, [focused, hash, kind, path])
}

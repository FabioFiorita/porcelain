import { headLabel } from '@porcelain/contracts'
import { runUserAction } from '@porcelain/shared/background'
import { useEffect, useState } from 'react'

import { useGitWorkspace } from '@/features/git'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import {
  type BrowseDirsResult,
  browseDirsQuery,
  recentReposQuery,
} from '@/lib/daemon/procedures/connection'
import { useDaemonInvalidate, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo, useActiveRepo } from '@/lib/daemon/repo'

import { useShellStore } from './shell-store'
import { deriveWorkspaceIdentity, errorMessage, type WorkspaceIdentity } from './workspace-lists'

/**
 * The shell's presentation seam. Git workspace reads and writes live in the Git feature; this
 * adapter only turns its public state into the identity shown by the shell header.
 */

export function useWorkspaceHeader(): WorkspaceIdentity & {
  repo: ReturnType<typeof useActiveRepo>
} {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const repoPath = repo?.path ?? ''
  const workspace = useGitWorkspace({ enabled: repo !== null, placeholderData: true })

  return {
    ...deriveWorkspaceIdentity({
      branch: workspace.head.data === undefined ? null : headLabel(workspace.head.data),
      branchFailed: workspace.head.isError,
      environmentNickname: environment?.nickname ?? null,
      mainWorktreePath: workspace.worktrees.data?.[0]?.path ?? null,
      repoName: repo?.name ?? null,
      repoPath,
    }),
    repo,
  }
}

export type ProjectSheet = {
  /** `browse` is the daemon-side directory browser; `projects` is the recents list. */
  mode: 'projects' | 'browse'
  paired: boolean
  activePath: string | null
  projects: readonly { path: string; name: string }[]
  isLoading: boolean
  loadError: string | null
  browse: {
    result: BrowseDirsResult | undefined
    isFetching: boolean
    isLoading: boolean
    error: string | null
  }
  busyPath: string | null
  actionError: string | null
  /** Total void: failures land on actionError; busyPath cleared in finally. */
  open: (path: string) => void
  setBrowsePath: (path: string | null) => void
  startBrowsing: () => void
  stopBrowsing: () => void
}

/** Project recents plus the daemon-side directory browser used by local and remote daemons. */
export function useProjectSheet(open: boolean): ProjectSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const invalidate = useDaemonInvalidate()
  const [mode, setMode] = useState<'projects' | 'browse'>('projects')
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const recentQuery = useDaemonQuery(
    recentReposQuery,
    { includeWorktrees: false },
    { enabled: open && mode === 'projects', placeholderData: 'keepPreviousData' },
  )
  const browseQuery = useDaemonQuery(browseDirsQuery, browsePath, {
    enabled: open && mode === 'browse',
    placeholderData: 'keepPreviousData',
  })

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setBrowsePath(null)
      setBusyPath(null)
      setMode('projects')
    }
  }, [open])

  return {
    actionError,
    activePath: repo?.path ?? null,
    browse: {
      error: browseQuery.isError
        ? errorMessage(browseQuery.error, 'Could not browse this folder.')
        : null,
      isFetching: browseQuery.isFetching,
      isLoading: browseQuery.isLoading,
      result: browseQuery.data,
    },
    busyPath,
    isLoading: recentQuery.isLoading,
    loadError: recentQuery.isError
      ? errorMessage(recentQuery.error, 'Could not load recent projects.')
      : null,
    mode,
    open: (path): void => {
      setBusyPath(path)
      setActionError(null)
      runUserAction(
        async () => {
          await openRepo(path)
          invalidate(['recentRepos'])
          closeSheet()
        },
        (error) => {
          setActionError(errorMessage(error, 'Could not open that project.'))
        },
        () => {
          setBusyPath(null)
        },
      )
    },
    paired: environment !== null && environment.token !== null,
    projects: recentQuery.data ?? [],
    setBrowsePath,
    startBrowsing: () => {
      setActionError(null)
      setBrowsePath(null)
      setMode('browse')
    },
    stopBrowsing: () => {
      setActionError(null)
      setMode('projects')
    },
  }
}

import { headLabel } from '@porcelain/contracts'
import { runUserAction } from '@porcelain/shared/background'
import { useEffect, useState } from 'react'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { gitHeadQuery } from '@/lib/daemon/procedures/changes'
import {
  type BrowseDirsResult,
  browseDirsQuery,
  recentReposQuery,
} from '@/lib/daemon/procedures/connection'
import {
  type BranchRef,
  gitAddWorktreeMutation,
  gitBranchesQuery,
  gitCheckoutMutation,
  gitCreateBranchMutation,
  gitWorktreesQuery,
  WORKSPACE_ADD_WORKTREE_INVALIDATIONS,
  WORKSPACE_CHECKOUT_INVALIDATIONS,
  type Worktree,
} from '@/lib/daemon/procedures/workspace'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo, useActiveRepo } from '@/lib/daemon/repo'

import { useShellStore } from './shell-store'
import {
  blockingWorktree,
  deriveWorkspaceIdentity,
  errorMessage,
  localBranchNames,
  matchBranches,
  type WorkspaceIdentity,
} from './workspace-lists'

/**
 * The shell's daemon seam — every workspace read and write in one file.
 *
 * The three picker sheets and the header used to call `useDaemonQuery` / `useDaemonMutation`
 * inline across one 900-line component file, which is the habit `use-<feature>.ts` exists to
 * stop. The sheets below are markup over these hooks; anything derived from what they return
 * lives in `workspace-lists.ts`, where it can be asserted without a runtime.
 */

/** HEAD is polled fast and never served stale: it is the label the whole header is judged by. */
const HEAD_POLL_MS = 5_000
/** The roster only moves when someone adds or removes a checkout. */
const WORKTREE_POLL_MS = 15_000

export function useWorkspaceHeader(): WorkspaceIdentity & {
  repo: ReturnType<typeof useActiveRepo>
} {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const repoPath = repo?.path ?? ''
  const head = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: repo !== null,
    pollMs: HEAD_POLL_MS,
    staleTime: 0,
  })
  const worktrees = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: WORKTREE_POLL_MS,
  })

  return {
    ...deriveWorkspaceIdentity({
      branch: head.data === undefined ? null : headLabel(head.data),
      branchFailed: head.isError,
      environmentNickname: environment?.nickname ?? null,
      mainWorktreePath: worktrees.data?.[0]?.path ?? null,
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

export type BranchSheet = {
  repoPath: string | null
  query: string
  setQuery: (query: string) => void
  currentBranch: string | null
  local: readonly BranchRef[]
  remote: readonly BranchRef[]
  /** Unfiltered: the create form validates against every local name, not the searched subset. */
  existingBranches: readonly string[]
  worktrees: readonly Worktree[]
  isLoading: boolean
  loadError: string | null
  isEmpty: boolean
  busy: boolean
  createPending: boolean
  actionError: string | null
  createError: string | null
  clearCreateError: () => void
  /** Total void: failures land on actionError / createError. */
  select: (branch: BranchRef) => void
  create: (branch: string) => void
}

/** Searchable Local / Remote branch picker with the daemon's worktree guard. */
export function useBranchSheet(
  open: boolean,
  onCreatingChange: (creating: boolean) => void,
): BranchSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const openSheet = useShellStore((state) => state.openSheet)
  const repo = useActiveRepo()
  const invalidate = useDaemonInvalidate()
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const repoPath = repo?.path ?? ''
  const headQuery = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: open && repo !== null,
    pollMs: HEAD_POLL_MS,
    staleTime: 0,
  })
  const branchesQuery = useDaemonQuery(gitBranchesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    // Branch refs can change outside the mobile client; the sheet establishes the
    // freshness boundary when it opens instead of trusting the shared 5s cache.
    staleTime: 0,
  })
  const worktreesQuery = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: WORKTREE_POLL_MS,
  })
  const checkout = useDaemonMutation(gitCheckoutMutation, {
    invalidates: WORKSPACE_CHECKOUT_INVALIDATIONS,
  })
  // `checkout -b` lands HEAD on the new branch, so creating one has a checkout's blast radius.
  const createBranch = useDaemonMutation(gitCreateBranchMutation, {
    invalidates: WORKSPACE_CHECKOUT_INVALIDATIONS,
  })

  const branches = branchesQuery.data ?? []
  const worktrees = worktreesQuery.data ?? []
  const currentBranch = headQuery.data === undefined ? null : headLabel(headQuery.data)
  const matched = matchBranches(branches, query)

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setCreateError(null)
      setQuery('')
      return
    }
    if (repoPath !== '') invalidate(['gitBranches'])
  }, [open, invalidate, repoPath])

  return {
    actionError,
    busy: checkout.isPending,
    clearCreateError: () => {
      setCreateError(null)
    },
    create: (branch): void => {
      if (repo === null || createBranch.isPending) return
      setCreateError(null)
      runUserAction(
        async () => {
          await createBranch.mutateAsync({ branch, repoPath: repo.path })
          onCreatingChange(false)
          closeSheet()
        },
        (error) => {
          // git's refusal (an existing branch, a malformed ref) is the message worth reading.
          setCreateError(errorMessage(error, 'Create branch failed.'))
        },
      )
    },
    createError,
    createPending: createBranch.isPending,
    currentBranch,
    existingBranches: localBranchNames(branches),
    isEmpty: !branchesQuery.isLoading && !branchesQuery.isError && branches.length === 0,
    isLoading: branchesQuery.isLoading,
    loadError: branchesQuery.isError
      ? errorMessage(branchesQuery.error, 'Could not load branches.')
      : null,
    local: matched.local,
    query,
    remote: matched.remote,
    repoPath: repo?.path ?? null,
    select: (branch): void => {
      if (blockingWorktree(worktrees, branch.name, repoPath) !== undefined) {
        openSheet('worktree')
        return
      }
      if (repo === null || branch.name === currentBranch) {
        closeSheet()
        return
      }

      setActionError(null)
      runUserAction(
        async () => {
          await checkout.mutateAsync({ branch: branch.name, repoPath: repo.path })
          closeSheet()
        },
        (error) => {
          setActionError(errorMessage(error, 'Checkout failed.'))
        },
      )
    },
    setQuery,
    worktrees,
  }
}

export type WorktreeSheet = {
  repoPath: string | null
  worktrees: readonly Worktree[]
  existingBranches: readonly string[]
  fromLabel: string
  isLoading: boolean
  loadError: string | null
  busy: boolean
  busyPath: string | null
  actionError: string | null
  createError: string | null
  clearCreateError: () => void
  /** Total void: failures land on actionError / createError; busyPath cleared in finally. */
  open: (path: string) => void
  create: (branch: string) => void
}

/** Worktree switcher: switching the row opens that checkout, including linked worktrees. */
export function useWorktreeSheet(
  open: boolean,
  onCreatingChange: (creating: boolean) => void,
): WorktreeSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const repo = useActiveRepo()
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const repoPath = repo?.path ?? ''
  const worktreesQuery = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: WORKTREE_POLL_MS,
  })
  // `worktree add -b` creates a branch too, so this sheet needs the same HEAD and roster the
  // branch sheet reads to say what it forks from and to reject a name git already knows.
  const headQuery = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: open && repo !== null,
    pollMs: HEAD_POLL_MS,
    staleTime: 0,
  })
  const branchesQuery = useDaemonQuery(gitBranchesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    staleTime: 0,
  })
  const addWorktree = useDaemonMutation(gitAddWorktreeMutation, {
    invalidates: WORKSPACE_ADD_WORKTREE_INVALIDATIONS,
  })

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setBusyPath(null)
      setCreateError(null)
    }
  }, [open])

  return {
    actionError,
    busy: addWorktree.isPending || busyPath !== null,
    busyPath,
    clearCreateError: () => {
      setCreateError(null)
    },
    create: (branch): void => {
      if (repo === null || addWorktree.isPending || busyPath !== null) return
      setCreateError(null)
      runUserAction(
        async () => {
          // The daemon derives and realpaths the destination, so its answer — not the preview the
          // form showed — is what gets opened. Creating a worktree you are not standing in would
          // leave the tap with nothing to show for it. The form stays up until the switch lands so
          // a failing open still has somewhere to report.
          const created = await addWorktree.mutateAsync({ branch, repoPath: repo.path })
          setBusyPath(created.path)
          await openRepo(created.path)
          onCreatingChange(false)
          closeSheet()
        },
        (error) => {
          setCreateError(errorMessage(error, 'Create worktree failed.'))
        },
        () => {
          setBusyPath(null)
        },
      )
    },
    createError,
    existingBranches: localBranchNames(branchesQuery.data ?? []),
    fromLabel: headQuery.data === undefined ? 'HEAD' : headLabel(headQuery.data),
    isLoading: worktreesQuery.isLoading,
    loadError: worktreesQuery.isError
      ? errorMessage(worktreesQuery.error, 'Could not load worktrees.')
      : null,
    open: (path): void => {
      if (path === repo?.path) {
        closeSheet()
        return
      }
      setBusyPath(path)
      setActionError(null)
      runUserAction(
        async () => {
          await openRepo(path)
          closeSheet()
        },
        (error) => {
          setActionError(errorMessage(error, 'Could not open that worktree.'))
        },
        () => {
          setBusyPath(null)
        },
      )
    },
    repoPath: repo?.path ?? null,
    worktrees: worktreesQuery.data ?? [],
  }
}

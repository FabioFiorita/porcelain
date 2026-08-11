import { headLabel } from '@porcelain/contracts'
import type { BranchRef, Worktree } from '@porcelain/contracts/git'
import { runUserAction, settleBackground } from '@porcelain/shared/background'
import { useEffect, useState } from 'react'

import { useShellStore } from '@/features/shell/shell-store'
import {
  blockingWorktree,
  errorMessage,
  localBranchNames,
  matchBranches,
} from '@/features/shell/workspace-lists'
import { openRepo, useActiveRepo } from '@/lib/daemon/repo'

import { useGitAddWorktree, useGitCheckout, useGitCreateBranch } from './git-mutations'
import { useGitWorkspace } from './git-queries'

export type GitBranchSheet = {
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
export function useGitBranchSheet(
  open: boolean,
  onCreatingChange: (creating: boolean) => void,
): GitBranchSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const openSheet = useShellStore((state) => state.openSheet)
  const repo = useActiveRepo()
  const workspace = useGitWorkspace({
    enabled: open && repo !== null,
    placeholderData: true,
  })
  const checkout = useGitCheckout()
  const createBranch = useGitCreateBranch()
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const repoPath = repo?.path ?? ''

  const branches = workspace.branches.data ?? []
  const worktrees = workspace.worktrees.data ?? []
  const currentBranch = workspace.head.data === undefined ? null : headLabel(workspace.head.data)
  const matched = matchBranches(branches, query)

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setCreateError(null)
      setQuery('')
      return
    }
    if (repoPath !== '') {
      settleBackground(workspace.refreshBranches(), 'invalidation')
    }
  }, [open, repoPath, workspace.refreshBranches])

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
          await createBranch.mutateAsync(branch)
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
    isEmpty: !workspace.branches.isLoading && !workspace.branches.isError && branches.length === 0,
    isLoading: workspace.branches.isLoading,
    loadError: workspace.branches.isError
      ? errorMessage(workspace.branches.error, 'Could not load branches.')
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
          await checkout.mutateAsync(branch.name)
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

export type GitWorktreeSheet = {
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
export function useGitWorktreeSheet(
  open: boolean,
  onCreatingChange: (creating: boolean) => void,
): GitWorktreeSheet {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const repo = useActiveRepo()
  const workspace = useGitWorkspace({
    enabled: open && repo !== null,
    placeholderData: true,
  })
  const addWorktree = useGitAddWorktree()
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

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
          const created = await addWorktree.mutateAsync(branch)
          if (created === undefined) return
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
    existingBranches: localBranchNames(workspace.branches.data ?? []),
    fromLabel: workspace.head.data === undefined ? 'HEAD' : headLabel(workspace.head.data),
    isLoading: workspace.worktrees.isLoading,
    loadError: workspace.worktrees.isError
      ? errorMessage(workspace.worktrees.error, 'Could not load worktrees.')
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
    worktrees: workspace.worktrees.data ?? [],
  }
}

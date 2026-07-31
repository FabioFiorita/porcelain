import type { Worktree } from '@backend/diff'
import type { BranchRef } from '@backend/git'
import type { InboxRow } from '@backend/worktree-inbox'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { headLabel } from '@shared/head'

/** The current HEAD as a label: a branch name, or `detached @ <short sha>`. The daemon
 *  reports the branch identity and the sha separately (`gitHead`); the label is built
 *  here so nothing downstream mistakes a detached HEAD for a checkout target — a
 *  branch-list comparison against this string simply never matches while detached. */
export function useBranch(): string | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitHead.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 5000,
  })
  return data === undefined ? undefined : headLabel(data)
}

export function useWorktrees(): Worktree[] {
  const repo = useRepoStore((s) => s.repo)
  const { data = [] } = trpc.gitWorktrees.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    // worktrees can be added/removed outside the app; poll slowly so the picker
    // self-heals without churning (the list rarely changes, unlike working-tree state)
    refetchInterval: 15000,
  })
  return data
}

/** The Review inbox: OTHER worktrees of this family with agent work awaiting review.
 *  Keyed off the open repo's path; polls at 15s like `useWorktrees` (the cross-worktree
 *  state changes slowly and off-app, so a slow poll self-heals without churn). */
export function useWorktreeInbox(): InboxRow[] {
  const repo = useRepoStore((s) => s.repo)
  const { data = [] } = trpc.worktreeInbox.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    refetchInterval: 15000,
  })
  return data
}

export function useBranches(): BranchRef[] {
  const repo = useRepoStore((s) => s.repo)
  const { data = [] } = trpc.gitBranches.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

/** Check out a branch by name. A remote-only name lets git DWIM a local tracking
 *  branch off the remote. Resolves on success; rejects with git's message (a
 *  dirty tree makes git refuse) so the caller can surface it. Checkout swaps the
 *  whole working tree, so — like pull/stash (useQuickCommand) — it blanket-
 *  invalidates everything mounted. */
export function useCheckout(): (branch: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitCheckout.useMutation()
  return async (branch) => {
    if (!repo) return
    try {
      await mutation.mutateAsync({ repoPath: repo.path, branch })
    } finally {
      await utils.invalidate()
    }
  }
}

/** Create a branch off the current HEAD and switch to it. Resolves on success;
 *  rejects with git's message (e.g. "already exists") so the caller can surface
 *  it. Same blast radius as checkout — creating-and-switching moves HEAD — so it
 *  blanket-invalidates everything mounted, like useCheckout. */
export function useCreateBranch(): (branch: string) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.gitCreateBranch.useMutation()
  return async (branch) => {
    if (!repo) return
    try {
      await mutation.mutateAsync({ repoPath: repo.path, branch })
    } finally {
      await utils.invalidate()
    }
  }
}

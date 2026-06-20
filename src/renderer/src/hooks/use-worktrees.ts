import type { Worktree } from '@main/diff'
import type { BranchRef } from '@main/git'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useBranch(): string | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.gitBranch.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 5000,
  })
  return data
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

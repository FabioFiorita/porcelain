import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** Returns the set of repo-relative paths the user has marked as reviewed for the current repo. */
export function useReviewedPaths(): Set<string> {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewedPaths.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return new Set(data ?? [])
}

/** Returns mark/unmark functions that persist the reviewed state and invalidate the query. */
export function useToggleReviewed(): {
  mark: (path: string) => Promise<void>
  unmark: (path: string) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const markMutation = trpc.markReviewed.useMutation({
    onSuccess: async () => {
      await utils.reviewedPaths.invalidate()
    },
  })
  const unmarkMutation = trpc.unmarkReviewed.useMutation({
    onSuccess: async () => {
      await utils.reviewedPaths.invalidate()
    },
  })
  return {
    mark: async (path) => {
      if (!repo) return
      await markMutation.mutateAsync({ repoPath: repo.path, path })
    },
    unmark: async (path) => {
      if (!repo) return
      await unmarkMutation.mutateAsync({ repoPath: repo.path, path })
    },
  }
}

/**
 * Replace all reviewed marks for the current repo in one write — powers the Changes
 * header's "mark all / unmark all" toggle (pass every path, or [] to clear them all).
 */
export function useSetReviewed(): (paths: string[]) => Promise<void> {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.setReviewed.useMutation({
    onSuccess: async () => {
      await utils.reviewedPaths.invalidate()
    },
  })
  return async (paths) => {
    if (!repo) return
    await mutation.mutateAsync({ repoPath: repo.path, paths })
  }
}

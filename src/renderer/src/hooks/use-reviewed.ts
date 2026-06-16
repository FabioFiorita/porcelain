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

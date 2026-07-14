import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** Returns the set of repo-relative paths the user has marked as reviewed for the current repo. */
export function useReviewedPaths(): Set<string> {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewedPaths.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    // Marks reconcile against the working tree (content-keyed) — an external commit or
    // post-mark edit prunes them — so poll like the flow queries to surface un-ticks.
    staleTime: 0,
    refetchInterval: 3000,
  })
  return new Set(data ?? [])
}

/** Returns mark/unmark functions that persist the reviewed state and invalidate the query. */
export function useToggleReviewed(): {
  mark: (path: string) => Promise<void>
  unmark: (path: string) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  // Optimistic: the checkbox flips on click, then the 3s poll reconciles against server truth.
  // cancelQueries stops in-flight polls from writing a pre-mark snapshot over the tick;
  // the server also re-reads after reconcile so a poll that started before the mark still
  // returns the new path once it finishes (see reconcileReviewed).
  const markMutation = trpc.markReviewed.useMutation({
    onMutate: async ({ repoPath, path }) => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(repoPath, [...new Set([...(previous ?? []), path])])
      return { previous, repoPath }
    },
    onError: (error, _vars, context) => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Mark reviewed')(error)
    },
    onSettled: async (_data, _error, { repoPath }) => {
      await utils.reviewedPaths.invalidate(repoPath)
    },
  })
  const unmarkMutation = trpc.unmarkReviewed.useMutation({
    onMutate: async ({ repoPath, path }) => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(
        repoPath,
        (previous ?? []).filter((p) => p !== path),
      )
      return { previous, repoPath }
    },
    onError: (error, _vars, context) => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Unmark reviewed')(error)
    },
    onSettled: async (_data, _error, { repoPath }) => {
      await utils.reviewedPaths.invalidate(repoPath)
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
    onMutate: async ({ repoPath, paths }) => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(repoPath, paths)
      return { previous, repoPath }
    },
    onError: (error, _vars, context) => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Update reviewed')(error)
    },
    onSettled: async (_data, _error, { repoPath }) => {
      await utils.reviewedPaths.invalidate(repoPath)
    },
  })
  return async (paths) => {
    if (!repo) return
    await mutation.mutateAsync({ repoPath: repo.path, paths })
  }
}

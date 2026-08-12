import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useMemo } from 'react'

/** Returns the set of project-relative paths the user has marked as reviewed for the current project. */
export function useReviewedPaths(): Set<string> {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.reviewedPaths.useQuery(project?.path ?? '', {
    enabled: project !== null,
    // Marks reconcile against the working tree (content-keyed) — an external commit or
    // post-mark edit prunes them — so poll like the flow queries to surface un-ticks.
    staleTime: 0,
    refetchInterval: 3000,
  })
  return useMemo(() => new Set(data ?? []), [data])
}

/** Optimistic-update rollback context: the pre-mutation reviewed-paths snapshot for one project. */
type MutationContext = { previous: string[] | undefined; repoPath: string }

type MarkVars = { repoPath: string; path: string }
type SetReviewedVars = { repoPath: string; paths: string[] }

/** Returns mark/unmark functions that persist the reviewed state and invalidate the query. */
export function useToggleReviewed(): {
  /** Total void: mutation onError/onSettled own failure + invalidation. Safe at sync UI edges. */
  mark: (path: string) => void
  unmark: (path: string) => void
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  // Optimistic: the checkbox flips on click, then the 3s poll reconciles against server truth.
  // cancelQueries stops in-flight polls from writing a pre-mark snapshot over the tick;
  // the server also re-reads after reconcile so a poll that started before the mark still
  // returns the new path once it finishes (see reconcileReviewed).
  const markMutation = trpc.markReviewed.useMutation({
    onMutate: async ({ repoPath, path }: MarkVars): Promise<MutationContext> => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(repoPath, [...new Set([...(previous ?? []), path])])
      return { previous, repoPath }
    },
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Mark reviewed')(error)
    },
    onSettled: async (_data: unknown, _error: unknown, { repoPath }: MarkVars): Promise<void> => {
      await utils.reviewedPaths.invalidate(repoPath)
    },
  })
  const unmarkMutation = trpc.unmarkReviewed.useMutation({
    onMutate: async ({ repoPath, path }: MarkVars): Promise<MutationContext> => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(
        repoPath,
        (previous ?? []).filter((p) => p !== path),
      )
      return { previous, repoPath }
    },
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Unmark reviewed')(error)
    },
    onSettled: async (_data: unknown, _error: unknown, { repoPath }: MarkVars): Promise<void> => {
      await utils.reviewedPaths.invalidate(repoPath)
    },
  })
  return {
    mark: (path: string): void => {
      if (!project) return
      markMutation.mutate({ repoPath: project.path, path })
    },
    unmark: (path: string): void => {
      if (!project) return
      unmarkMutation.mutate({ repoPath: project.path, path })
    },
  }
}

/**
 * Replace all reviewed marks for the current project in one write — powers the Changes
 * header's "mark all / unmark all" toggle (pass every path, or [] to clear them all).
 */
export function useSetReviewed(): (paths: string[]) => void {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const mutation = trpc.setReviewed.useMutation({
    onMutate: async ({ repoPath, paths }: SetReviewedVars): Promise<MutationContext> => {
      await utils.reviewedPaths.cancel(repoPath)
      const previous = utils.reviewedPaths.getData(repoPath)
      utils.reviewedPaths.setData(repoPath, paths)
      return { previous, repoPath }
    },
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      if (context) utils.reviewedPaths.setData(context.repoPath, context.previous)
      onMutationError('Update reviewed')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: SetReviewedVars,
    ): Promise<void> => {
      await utils.reviewedPaths.invalidate(repoPath)
    },
  })
  return (paths: string[]): void => {
    if (!project) return
    mutation.mutate({ repoPath: project.path, paths })
  }
}

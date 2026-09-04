import { reviewedPathsQuery } from '@porcelain/client-runtime/review'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { hubOwnerClient, useHubRepoOwner } from '@renderer/hooks/use-hub-owner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ReviewedScope } from '@porcelain/contracts/review'

type SetVariables = { repoPath: string; paths: string[]; reviewed: boolean; scope?: ReviewedScope }
type MutationContext = { previous: string[] | undefined; queryKey: readonly unknown[] }

function reviewedPathsKey(
  identity: { host: string | null; version: string | null },
  path: string,
  scope: ReviewedScope,
): readonly unknown[] {
  return [reviewedPathsQuery(path, scope), identity] as const
}

export function useReviewedPaths(scope: ReviewedScope = { type: 'working' }): Set<string> {
  const { repoPath, daemon, owner } = useHubRepoOwner()
  const path = repoPath ?? '/__porcelain-disabled-reviewed-paths__'
  const query = useQuery({
    enabled: repoPath !== null && owner !== null,
    queryFn: () =>
      hubOwnerClient(owner).reviewedPaths.query(
        scope.type === 'working' ? path : { repoPath: path, scope },
      ),
    queryKey: reviewedPathsKey(daemon, path, scope),
    refetchInterval: repoPath === null ? false : 3000,
    staleTime: 0,
  })
  return useMemo(() => new Set(query.data ?? []), [query.data])
}

function useReviewedMutation(
  scope: ReviewedScope,
  execute: (input: SetVariables) => Promise<void>,
  title: string,
  update: (previous: string[] | undefined, input: SetVariables) => string[],
): ReturnType<typeof useMutation<void, Error, SetVariables>> {
  const { repoPath, daemon } = useHubRepoOwner()
  const queryClient = useQueryClient()
  const path = repoPath ?? '/__porcelain-disabled-reviewed-paths__'
  const queryKey = reviewedPathsKey(daemon, path, scope)
  return useMutation<void, Error, SetVariables, MutationContext>({
    mutationFn: execute,
    onError: (error, _input, context): void => {
      if (context !== undefined) queryClient.setQueryData(context.queryKey, context.previous)
      onMutationError(title)(error)
    },
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey, exact: true })
      const previous = queryClient.getQueryData<string[]>(queryKey)
      queryClient.setQueryData(queryKey, update(previous, input))
      return { previous, queryKey }
    },
    onSettled: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey, exact: true })
    },
  })
}

/**
 * The one reviewed-mark write: `setReviewed` is total over `{ repoPath, paths, reviewed }`,
 * so marking, unmarking, and the bulk header toggle are the same atomic call. The optimistic
 * update mirrors that totality — it adds or removes exactly the named paths.
 */
function useSetReviewedMutation(
  scope: ReviewedScope,
): ReturnType<typeof useMutation<void, Error, SetVariables>> {
  const { owner } = useHubRepoOwner()
  return useReviewedMutation(
    scope,
    (input) => hubOwnerClient(owner).setReviewed.mutate(input),
    'Update reviewed',
    (previous, input) => {
      if (!input.reviewed) {
        const dropped = new Set(input.paths)
        return (previous ?? []).filter((path) => !dropped.has(path))
      }
      return [...new Set([...(previous ?? []), ...input.paths])]
    },
  )
}

export function useToggleReviewed(scope: ReviewedScope = { type: 'working' }): {
  mark: (path: string) => void
  unmark: (path: string) => void
} {
  const { repoPath } = useHubRepoOwner()
  const mutation = useSetReviewedMutation(scope)
  return {
    mark: (path: string): void => {
      if (repoPath !== null)
        mutation.mutate({
          paths: [path],
          repoPath,
          reviewed: true,
          ...(scope.type === 'branch' ? { scope } : {}),
        })
    },
    unmark: (path: string): void => {
      if (repoPath !== null) {
        mutation.mutate({
          paths: [path],
          repoPath,
          reviewed: false,
          ...(scope.type === 'branch' ? { scope } : {}),
        })
      }
    },
  }
}

/** Bulk "mark all / unmark all" — one atomic write over the named paths. */
export function useSetReviewed(
  scope: ReviewedScope = { type: 'working' },
): (paths: string[], reviewed: boolean) => void {
  const { repoPath } = useHubRepoOwner()
  const mutation = useSetReviewedMutation(scope)
  return (paths: string[], reviewed: boolean): void => {
    if (repoPath !== null && paths.length > 0) {
      mutation.mutate({ paths, repoPath, reviewed, ...(scope.type === 'branch' ? { scope } : {}) })
    }
  }
}

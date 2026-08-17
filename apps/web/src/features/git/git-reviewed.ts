import { reviewedPathsQuery } from '@porcelain/client-runtime/review'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

type SetVariables = { repoPath: string; paths: string[]; reviewed: boolean }
type MutationContext = { previous: string[] | undefined; queryKey: readonly unknown[] }

function daemonScope(identity: { host: string | null; version: string | null }) {
  return { host: identity.host, version: identity.version }
}

function reviewedPathsKey(
  identity: { host: string | null; version: string | null },
  path: string,
): readonly unknown[] {
  return [reviewedPathsQuery(path), daemonScope(identity)] as const
}

export function useReviewedPaths(): Set<string> {
  const repoPath = useHubRepoPath()
  const identity = useDaemonIdentity()
  const utils = trpc.useUtils()
  const path = repoPath ?? '/__porcelain-disabled-reviewed-paths__'
  const query = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.reviewedPaths.query(path),
    queryKey: reviewedPathsKey(identity, path),
    refetchInterval: repoPath === null ? false : 3000,
    staleTime: 0,
  })
  return useMemo(() => new Set(query.data ?? []), [query.data])
}

function useReviewedMutation(
  execute: (input: SetVariables) => Promise<void>,
  title: string,
  update: (previous: string[] | undefined, input: SetVariables) => string[],
): ReturnType<typeof useMutation<void, Error, SetVariables>> {
  const repoPath = useHubRepoPath()
  const identity = useDaemonIdentity()
  const queryClient = useQueryClient()
  const path = repoPath ?? '/__porcelain-disabled-reviewed-paths__'
  const queryKey = reviewedPathsKey(identity, path)
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
function useSetReviewedMutation(): ReturnType<typeof useMutation<void, Error, SetVariables>> {
  const utils = trpc.useUtils()
  return useReviewedMutation(
    (input) => utils.client.setReviewed.mutate(input),
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

export function useToggleReviewed(): {
  mark: (path: string) => void
  unmark: (path: string) => void
} {
  const repoPath = useHubRepoPath()
  const mutation = useSetReviewedMutation()
  return {
    mark: (path: string): void => {
      if (repoPath !== null) mutation.mutate({ paths: [path], repoPath, reviewed: true })
    },
    unmark: (path: string): void => {
      if (repoPath !== null) {
        mutation.mutate({ paths: [path], repoPath, reviewed: false })
      }
    },
  }
}

/** Bulk "mark all / unmark all" — one atomic write over the named paths. */
export function useSetReviewed(): (paths: string[], reviewed: boolean) => void {
  const repoPath = useHubRepoPath()
  const mutation = useSetReviewedMutation()
  return (paths: string[], reviewed: boolean): void => {
    if (repoPath !== null && paths.length > 0) {
      mutation.mutate({ paths, repoPath, reviewed })
    }
  }
}

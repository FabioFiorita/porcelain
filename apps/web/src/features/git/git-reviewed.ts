import { reviewedPathsQuery } from '@porcelain/client-runtime/review'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { invalidateGitEffects } from './git-query-filter'
import { gitQueryKey } from './git-query-key'

type SetVariables = { repoPath: string; paths: string[]; reviewed: boolean }
type MutationContext = { previous: string[] | undefined; queryKey: readonly unknown[] }

function daemonScope(identity: { host: string | null; version: string | null }) {
  return { host: identity.host, version: identity.version }
}

export function useReviewedPaths(): Set<string> {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const utils = trpc.useUtils()
  const path = project?.path ?? '/__porcelain-disabled-reviewed-paths__'
  const query = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.reviewedPaths.query(path),
    queryKey: gitQueryKey(daemonScope(identity), reviewedPathsQuery(path)),
    refetchInterval: project === null ? false : 3000,
    staleTime: 0,
  })
  return useMemo(() => new Set(query.data ?? []), [query.data])
}

function useReviewedMutation(
  execute: (input: SetVariables) => Promise<void>,
  title: string,
  update: (previous: string[] | undefined, input: SetVariables) => string[],
): ReturnType<typeof useMutation<void, Error, SetVariables>> {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const queryClient = useQueryClient()
  const path = project?.path ?? '/__porcelain-disabled-reviewed-paths__'
  const queryKey = gitQueryKey(daemonScope(identity), reviewedPathsQuery(path))
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
      await invalidateGitEffects(queryClient, daemonScope(identity), [reviewedPathsQuery(path)])
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
  const project = useProjectSelectionStore((state) => state.project)
  const mutation = useSetReviewedMutation()
  return {
    mark: (path: string): void => {
      if (project !== null)
        mutation.mutate({ paths: [path], repoPath: project.path, reviewed: true })
    },
    unmark: (path: string): void => {
      if (project !== null) {
        mutation.mutate({ paths: [path], repoPath: project.path, reviewed: false })
      }
    },
  }
}

/** Bulk "mark all / unmark all" — one atomic write over the named paths. */
export function useSetReviewed(): (paths: string[], reviewed: boolean) => void {
  const project = useProjectSelectionStore((state) => state.project)
  const mutation = useSetReviewedMutation()
  return (paths: string[], reviewed: boolean): void => {
    if (project !== null && paths.length > 0) {
      mutation.mutate({ paths, repoPath: project.path, reviewed })
    }
  }
}

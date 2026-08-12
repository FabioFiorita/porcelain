import { reviewedPathsQuery } from '@porcelain/client-runtime/git'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { invalidateGitEffects } from './git-query-filter'
import { gitQueryKey } from './git-query-key'

type MarkVariables = { repoPath: string; path: string }
type SetVariables = { repoPath: string; paths: string[] }
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

function useReviewedMutation<TInput extends MarkVariables | SetVariables>(
  execute: (input: TInput) => Promise<void>,
  title: string,
  update: (previous: string[] | undefined, input: TInput) => string[],
): ReturnType<typeof useMutation<void, Error, TInput>> {
  const project = useProjectSelectionStore((state) => state.project)
  const identity = useDaemonIdentity()
  const queryClient = useQueryClient()
  const path = project?.path ?? '/__porcelain-disabled-reviewed-paths__'
  const queryKey = gitQueryKey(daemonScope(identity), reviewedPathsQuery(path))
  return useMutation<void, Error, TInput, MutationContext>({
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

export function useToggleReviewed(): {
  mark: (path: string) => void
  unmark: (path: string) => void
} {
  const project = useProjectSelectionStore((state) => state.project)
  const utils = trpc.useUtils()
  const mark = useReviewedMutation<MarkVariables>(
    (input) => utils.client.markReviewed.mutate(input),
    'Mark reviewed',
    (previous, input) => [...new Set([...(previous ?? []), input.path])],
  )
  const unmark = useReviewedMutation<MarkVariables>(
    async (input): Promise<void> => {
      await utils.client.unmarkReviewed.mutate(input)
    },
    'Unmark reviewed',
    (previous, input) => (previous ?? []).filter((path) => path !== input.path),
  )
  return {
    mark: (path: string): void => {
      if (project !== null) mark.mutate({ path, repoPath: project.path })
    },
    unmark: (path: string): void => {
      if (project !== null) {
        const input = { path, repoPath: project.path }
        unmark.mutate(input)
      }
    },
  }
}

export function useSetReviewed(): (paths: string[]) => void {
  const project = useProjectSelectionStore((state) => state.project)
  const utils = trpc.useUtils()
  const mutation = useReviewedMutation<SetVariables>(
    (input) => utils.client.setReviewed.mutate(input),
    'Update reviewed',
    (_previous, input) => input.paths,
  )
  return (paths: string[]): void => {
    if (project !== null) mutation.mutate({ paths, repoPath: project.path })
  }
}

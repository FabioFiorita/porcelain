import type { UseQueryResult } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import type { DaemonError } from '@/lib/daemon/errors'
import {
  markReviewedMutation,
  reviewedPathsQuery,
  unmarkReviewedMutation,
} from '@/lib/daemon/procedures/changes'
import { daemonKeys, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

export function useReviewedPaths(): UseQueryResult<string[], DaemonError> {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  return useDaemonQuery(reviewedPathsQuery, repo?.path ?? '', {
    backstopMs: 10_000,
    enabled: repo !== null && focused,
    staleTime: 0,
  })
}

type ReviewedAction = (path: string) => Promise<void>

export function useReviewedActions(): {
  mark: ReviewedAction
  unmark: ReviewedAction
} {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const markMutation = useDaemonMutation(markReviewedMutation, { invalidates: ['reviewedPaths'] })
  const unmarkMutation = useDaemonMutation(unmarkReviewedMutation, {
    invalidates: ['reviewedPaths'],
  })

  async function run(path: string, add: boolean): Promise<void> {
    if (repo === null || environment === null) return
    const queryKey = daemonKeys.call(environment.id, reviewedPathsQuery.name, repo.path)
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData<string[]>(queryKey)
    const next = add
      ? [...new Set([...(previous ?? []), path])]
      : (previous ?? []).filter((candidate) => candidate !== path)
    queryClient.setQueryData(queryKey, next)
    try {
      if (add) {
        await markMutation.mutateAsync({ path, repoPath: repo.path })
      } else {
        await unmarkMutation.mutateAsync({ path, repoPath: repo.path })
      }
    } catch (error) {
      queryClient.setQueryData(queryKey, previous)
      throw error
    }
  }

  return {
    mark: async (path: string): Promise<void> => {
      await run(path, true)
    },
    unmark: async (path: string): Promise<void> => {
      await run(path, false)
    },
  }
}

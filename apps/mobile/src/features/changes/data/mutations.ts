import { useQueryClient } from '@tanstack/react-query'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import type { DaemonError } from '@/lib/daemon/errors'
import {
  gitCommitMutation,
  gitDiscardFileMutation,
  gitPushMutation,
  gitStageAllMutation,
  gitStageFileMutation,
  gitUnstageAllMutation,
  gitUnstageFileMutation,
  markReviewedMutation,
  reviewedPathsQuery,
  setReviewedMutation,
  unmarkReviewedMutation,
} from '@/lib/daemon/procedures/changes'
import { daemonKeys, useDaemonMutation } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'
import { CHANGES_INVALIDATIONS } from './invalidation'

type ChangeAction<TOutput> = {
  readonly error: DaemonError | null
  readonly isPending: boolean
  readonly run: () => Promise<TOutput>
}

type FileChangeAction = {
  readonly error: DaemonError | null
  readonly isPending: boolean
  readonly run: (path: string) => Promise<void>
}

type ReviewedPathsAction = {
  readonly error: DaemonError | null
  readonly isPending: boolean
  readonly run: (paths: string[]) => Promise<void>
}

export type ChangesMutations = {
  readonly commit: {
    readonly error: DaemonError | null
    readonly isPending: boolean
    readonly run: (message: string) => Promise<void>
  }
  readonly discardFile: FileChangeAction
  readonly markReviewed: FileChangeAction
  readonly push: ChangeAction<string>
  readonly setReviewed: ReviewedPathsAction
  readonly stageAll: ChangeAction<void>
  readonly stageFile: FileChangeAction
  readonly unmarkReviewed: FileChangeAction
  readonly unstageAll: ChangeAction<void>
  readonly unstageFile: FileChangeAction
}

export function useChangesMutations(): ChangesMutations {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const stageAllMutation = useDaemonMutation(gitStageAllMutation, {
    invalidates: CHANGES_INVALIDATIONS.stage,
  })
  const unstageAllMutation = useDaemonMutation(gitUnstageAllMutation, {
    invalidates: CHANGES_INVALIDATIONS.stage,
  })
  const stageFileMutation = useDaemonMutation(gitStageFileMutation, {
    invalidates: CHANGES_INVALIDATIONS.stage,
  })
  const unstageFileMutation = useDaemonMutation(gitUnstageFileMutation, {
    invalidates: CHANGES_INVALIDATIONS.stage,
  })
  const discardFileMutation = useDaemonMutation(gitDiscardFileMutation, {
    invalidates: CHANGES_INVALIDATIONS.discard,
  })
  const commitMutation = useDaemonMutation(gitCommitMutation, {
    invalidates: CHANGES_INVALIDATIONS.commit,
  })
  const pushMutation = useDaemonMutation<{ repoPath: string }, string>(gitPushMutation, {
    invalidates: CHANGES_INVALIDATIONS.push,
  })
  const markReviewedMutationResult = useDaemonMutation(markReviewedMutation, {
    invalidates: CHANGES_INVALIDATIONS.reviewed,
  })
  const unmarkReviewedMutationResult = useDaemonMutation(unmarkReviewedMutation, {
    invalidates: CHANGES_INVALIDATIONS.reviewed,
  })
  const setReviewedMutationResult = useDaemonMutation(setReviewedMutation, {
    invalidates: CHANGES_INVALIDATIONS.reviewed,
  })

  async function runVoidRepoAction(run: (repoPath: string) => Promise<void>): Promise<void> {
    if (repo === null) return
    await run(repo.path)
  }

  async function runStringRepoAction(run: (repoPath: string) => Promise<string>): Promise<string> {
    if (repo === null) return ''
    return await run(repo.path)
  }

  async function runReviewedAction(
    path: string,
    add: boolean,
    run: (repoPath: string, path: string) => Promise<void>,
  ): Promise<void> {
    if (repo === null || environment === null) return
    const queryKey = daemonKeys.call(environment.id, reviewedPathsQuery.name, repo.path)
    const previous = queryClient.getQueryData<string[]>(queryKey)
    const next = add
      ? [...new Set([...(previous ?? []), path])]
      : (previous ?? []).filter((current) => current !== path)
    queryClient.setQueryData(queryKey, next)
    try {
      await run(repo.path, path)
    } catch (error) {
      queryClient.setQueryData(queryKey, previous)
      throw error
    }
  }

  async function runSetReviewed(paths: string[]): Promise<void> {
    if (repo === null || environment === null) return
    const queryKey = daemonKeys.call(environment.id, reviewedPathsQuery.name, repo.path)
    const previous = queryClient.getQueryData<string[]>(queryKey)
    queryClient.setQueryData(queryKey, paths)
    try {
      await setReviewedMutationResult.mutateAsync({ paths, repoPath: repo.path })
    } catch (error) {
      queryClient.setQueryData(queryKey, previous)
      throw error
    }
  }

  return {
    commit: {
      error: commitMutation.error,
      isPending: commitMutation.isPending,
      run: async (message: string): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await commitMutation.mutateAsync({ message, repoPath })
        })
      },
    },
    discardFile: {
      error: discardFileMutation.error,
      isPending: discardFileMutation.isPending,
      run: async (path: string): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await discardFileMutation.mutateAsync({ path, repoPath })
        })
      },
    },
    markReviewed: {
      error: markReviewedMutationResult.error,
      isPending: markReviewedMutationResult.isPending,
      run: async (path: string): Promise<void> => {
        await runReviewedAction(path, true, async (repoPath: string, currentPath: string) => {
          await markReviewedMutationResult.mutateAsync({ path: currentPath, repoPath })
        })
      },
    },
    push: {
      error: pushMutation.error,
      isPending: pushMutation.isPending,
      run: async (): Promise<string> =>
        await runStringRepoAction(
          async (repoPath: string): Promise<string> => await pushMutation.mutateAsync({ repoPath }),
        ),
    },
    setReviewed: {
      error: setReviewedMutationResult.error,
      isPending: setReviewedMutationResult.isPending,
      run: runSetReviewed,
    },
    stageAll: {
      error: stageAllMutation.error,
      isPending: stageAllMutation.isPending,
      run: async (): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await stageAllMutation.mutateAsync({ repoPath })
        })
      },
    },
    stageFile: {
      error: stageFileMutation.error,
      isPending: stageFileMutation.isPending,
      run: async (path: string): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await stageFileMutation.mutateAsync({ path, repoPath })
        })
      },
    },
    unmarkReviewed: {
      error: unmarkReviewedMutationResult.error,
      isPending: unmarkReviewedMutationResult.isPending,
      run: async (path: string): Promise<void> => {
        await runReviewedAction(path, false, async (repoPath: string, currentPath: string) => {
          await unmarkReviewedMutationResult.mutateAsync({ path: currentPath, repoPath })
        })
      },
    },
    unstageAll: {
      error: unstageAllMutation.error,
      isPending: unstageAllMutation.isPending,
      run: async (): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await unstageAllMutation.mutateAsync({ repoPath })
        })
      },
    },
    unstageFile: {
      error: unstageFileMutation.error,
      isPending: unstageFileMutation.isPending,
      run: async (path: string): Promise<void> => {
        await runVoidRepoAction(async (repoPath: string): Promise<void> => {
          await unstageFileMutation.mutateAsync({ path, repoPath })
        })
      },
    },
  }
}

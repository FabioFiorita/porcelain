import { gitStatusQuery } from '@porcelain/client-runtime/git'
import { reviewMutations } from '@porcelain/client-runtime/review'
import type { ArchivedReviewIdInput, RepoPathInput } from '@porcelain/contracts/review'
import { invalidateGitEffects } from '@renderer/features/git'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateAllReviewComments } from './comments'
import { invalidateReviewEffects } from './review-query-filter'

/**
 * Web Review mutation adapter (REV-007), following `features/board/board-mutations.ts`.
 *
 * Each hook binds one REV-006 definition to the vanilla tRPC client and invalidates exactly
 * the identities that definition declares. None is optimistic: archive, publish, restore,
 * delete and clear all perform Git, filesystem or process work whose outcome the client
 * cannot predict. A failed refresh must never read as a failed write, so the post-write
 * refresh keeps the `invalidateAfterSuccess` "succeeded, but the UI may be stale" contract.
 *
 * Two cross-domain refreshes live here rather than in a client-runtime definition (REV-006
 * ruling 7): archive and restore also drop the comments cache, and publish also refreshes
 * `gitStatus` because publishing stages the archived folder.
 */

function useReviewMutationContext(): {
  readonly daemon: DaemonScope
  readonly projectPath: string | null
} {
  const identity = useDaemonIdentity()
  const project = useProjectSelectionStore((s) => s.project)
  return {
    daemon: { host: identity.host, version: identity.version },
    projectPath: project?.path ?? null,
  }
}

/**
 * Archive the active review (intent, comments, reviewed, evidence) under
 * `.porcelain/reviews/<id>/` and clear active slots → "No review yet".
 */
export function useArchiveReview(): { archive: () => Promise<void>; isArchiving: boolean } {
  const { daemon, projectPath } = useReviewMutationContext()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<void, Error, RepoPathInput>({
    mutationFn: (input) => utils.client.archiveReview.mutate(input),
    onError: onMutationError('Archive review'),
    onSettled: (_data, error, input): Promise<void> | undefined => {
      if (error !== null || input === undefined) return undefined
      // The archive is already on disk; only the refresh can still fail.
      return invalidateAfterSuccess(
        [
          invalidateReviewEffects(
            queryClient,
            daemon,
            reviewMutations.archiveReview.affectedQueries(input),
          ),
          invalidateAllReviewComments(queryClient),
        ],
        'Archive review',
      )
    },
  })
  return {
    archive: async (): Promise<void> => {
      if (projectPath === null) return
      await mutation.mutateAsync(projectPath)
    },
    isArchiving: mutation.isPending,
  }
}

/**
 * Publish the active review: archive it and stage the folder for the team. Publishing also
 * makes the Changes tab stale, which is why `gitStatus` is refreshed through Git's entry.
 */
export function usePublishReview(): {
  publish: () => Promise<string | null>
  isPublishing: boolean
} {
  const { daemon, projectPath } = useReviewMutationContext()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation({
    mutationFn: (input: RepoPathInput) => utils.client.publishReview.mutate(input),
    onError: onMutationError('Publish review'),
    onSettled: (_data, error, input): Promise<void> | undefined => {
      if (error !== null || input === undefined) return undefined
      // Server success must remain durable even when invalidation fails.
      return invalidateAfterSuccess(
        [
          invalidateReviewEffects(
            queryClient,
            daemon,
            reviewMutations.publishReview.affectedQueries(input),
          ),
          invalidateGitEffects(queryClient, daemon, [gitStatusQuery(input)]),
        ],
        'Publish review',
      )
    },
  })
  return {
    isPublishing: mutation.isPending,
    publish: async (): Promise<string | null> => {
      if (projectPath === null) return null
      const result = await mutation.mutateAsync(projectPath)
      return result?.id ?? null
    },
  }
}

/** Restore an archived review into the active slots. */
export function useRestoreArchivedReview(): {
  restore: (id: string) => Promise<void>
  isRestoring: boolean
} {
  const { daemon, projectPath } = useReviewMutationContext()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<void, Error, ArchivedReviewIdInput>({
    mutationFn: (input) => utils.client.restoreArchivedReview.mutate(input),
    onError: onMutationError('Restore review'),
    onSettled: (_data, error, input): Promise<void> | undefined => {
      if (error !== null || input === undefined) return undefined
      return invalidateAfterSuccess(
        [
          invalidateReviewEffects(
            queryClient,
            daemon,
            reviewMutations.restoreArchivedReview.affectedQueries(input),
          ),
          invalidateAllReviewComments(queryClient),
        ],
        'Restore review',
      )
    },
  })
  return {
    isRestoring: mutation.isPending,
    restore: async (id: string): Promise<void> => {
      if (projectPath === null) return
      await mutation.mutateAsync({ id, repoPath: projectPath })
    },
  }
}

/** Delete one archived review folder. Only the archive listing goes stale. */
export function useDeleteArchivedReview(): {
  remove: (id: string) => Promise<void>
  isRemoving: boolean
} {
  const { daemon, projectPath } = useReviewMutationContext()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<void, Error, ArchivedReviewIdInput>({
    mutationFn: (input) => utils.client.deleteArchivedReview.mutate(input),
    onError: onMutationError('Delete review'),
    onSettled: (_data, error, input): Promise<void> | undefined => {
      if (error !== null || input === undefined) return undefined
      return invalidateAfterSuccess(
        [
          invalidateReviewEffects(
            queryClient,
            daemon,
            reviewMutations.deleteArchivedReview.affectedQueries(input),
          ),
        ],
        'Delete review',
      )
    },
  })
  return {
    isRemoving: mutation.isPending,
    remove: async (id: string): Promise<void> => {
      if (projectPath === null) return
      await mutation.mutateAsync({ id, repoPath: projectPath })
    },
  }
}

/**
 * Clear the agent's evidence pack for the current project — the app's one write to the
 * evidence channel. Clear deletes the whole directory, so the Results and Assets sub-tabs
 * go with it, and the reading is refreshed so the evidence chapter drops immediately.
 */
export function useClearEvidence(): { clear: () => Promise<void>; isClearing: boolean } {
  const { daemon, projectPath } = useReviewMutationContext()
  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const mutation = useMutation<void, Error, RepoPathInput>({
    mutationFn: (input) => utils.client.clearEvidence.mutate(input),
    onError: onMutationError('Clear evidence'),
    onSettled: (_data, error, input): Promise<void> | undefined => {
      if (error !== null || input === undefined) return undefined
      // The delete is durable once the mutation resolves; a failed refresh must not
      // read as a failed clear, so it degrades to a "UI may be stale" toast.
      return invalidateAfterSuccess(
        [
          invalidateReviewEffects(
            queryClient,
            daemon,
            reviewMutations.clearEvidence.affectedQueries(input),
          ),
        ],
        'Clear evidence',
      )
    },
  })
  return {
    clear: async (): Promise<void> => {
      if (projectPath === null) return
      await mutation.mutateAsync(projectPath)
    },
    isClearing: mutation.isPending,
  }
}

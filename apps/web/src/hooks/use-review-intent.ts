import type { ReviewDoc } from '@backend/review/doc-set'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** Intent documents the agent wrote under `.porcelain/intent/`, in tab order. */
export function useReviewIntent(): ReviewDoc[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewIntent.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data ?? []
}

/** Extra evidence documents beside index.html — tabs, same media as Intent. */
export function useReviewEvidenceDocs(): ReviewDoc[] {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewEvidenceDocs.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data ?? []
}

/** Bytes and file count publishing the active review would add to git history. */
export function useReviewPublishCost(
  enabled: boolean,
): { bytes: number; files: number } | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.reviewPublishCost.useQuery(repo?.path ?? '', {
    enabled: enabled && repo !== null,
  })
  return data
}

export function usePublishReview(): {
  publish: () => Promise<string | null>
  isPublishing: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.publishReview.useMutation({ onError: onMutationError('Publish review') })
  return {
    publish: async (): Promise<string | null> => {
      const repoPath = useRepoStore.getState().repo?.path
      if (!repoPath) return null
      const result = await mutation.mutateAsync(repoPath)
      // Publishing archives the active review and stages the folder, so the
      // Review surface, the archive list and the Changes tab are all now stale.
      // Server success must remain durable even when invalidation fails.
      await invalidateAfterSuccess(
        [
          utils.featureReading.invalidate(),
          utils.featureView.invalidate(),
          utils.reviewIntent.invalidate(),
          utils.archivedReviews.invalidate(),
          utils.gitStatus.invalidate(),
        ],
        'Publish review',
      )
      return result?.id ?? null
    },
    isPublishing: mutation.isPending,
  }
}

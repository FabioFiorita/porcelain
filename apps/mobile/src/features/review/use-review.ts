import { useQueryClient } from '@tanstack/react-query'

import { invalidateAllReviewComments } from '@/features/comments'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import {
  type ArchivedReview,
  archivedReviewsQuery,
  clearFeatureReviewMutation,
  clearLoopEvidenceMutation,
  deleteArchivedReviewMutation,
  type EvidenceAsset,
  type EvidenceAssetBody,
  type FeatureReading,
  featureReadingQuery,
  type IntentDoc,
  type PublishCost,
  publishReviewMutation,
  restoreArchivedReviewMutation,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'

/**
 * Every read the Review makes, and the rule each one follows.
 *
 * The rule that matters here is **lazy**: an Intent document set can be 8 MiB and an evidence
 * pack 4 MiB, and neither is worth a byte until the reader is actually on that canvas. So
 * `featureReading` — small, live, and what every other surface derives from — is the only
 * thing that polls, and the heavy reads are gated on their own tab being visible. Fetching
 * them beside the reading "to have them ready" is the one thing that would make this tab
 * expensive to open.
 */

/** Writes that change what the active review IS, and everything derived from it. */
const REVIEW_INVALIDATIONS = [
  'featureView',
  'featureReading',
  'reviewIntent',
  'reviewEvidenceDocs',
  'reviewEvidenceAssets',
  'reviewEvidenceAsset',
  'reviewPublishCost',
  'loopEvidence',
  'loopEvidenceHtml',
  'reviewedPaths',
  'archivedReviews',
] as const

/** Clearing evidence leaves the review alone; only the proof and its chapter move. */
const EVIDENCE_INVALIDATIONS = [
  'featureReading',
  'loopEvidence',
  'loopEvidenceHtml',
  'reviewEvidenceDocs',
  'reviewEvidenceAssets',
  'reviewEvidenceAsset',
  'reviewPublishCost',
] as const

export type ReviewReading = {
  /** `undefined` until the first read lands; `null` when there is no active review. */
  reading: FeatureReading | null | undefined
  isLoading: boolean
  error: Error | null
}

/**
 * The active Review document: name, thesis, walkthrough sections, the flow-grouped leftover
 * files, and the evidence chapter's metadata.
 *
 * Polls at the shared live rate because the agent rewrites `.porcelain/review.json` while you
 * read it — a Review that only refreshed on remount would show a story the agent has already
 * moved past.
 */
export function useFeatureReading(active: boolean): ReviewReading {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(featureReadingQuery, project?.path ?? '', {
    enabled: active && project !== null,
    placeholderData: 'keepPreviousData',
    pollMs: LIVE_POLL_MS,
    staleTime: 0,
  })
  return { error, isLoading, reading: data }
}

/**
 * Intent documents. `enabled` is the Intent canvas being on screen, and there is no poll: a
 * document the agent rewrites is picked up by the next mutation invalidation or the next time
 * the tab is opened, which is cheap. Re-reading megabytes every few seconds is not.
 */
export function useReviewIntentDocs(enabled: boolean): {
  docs: IntentDoc[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(reviewIntentQuery, project?.path ?? '', {
    enabled: enabled && project !== null,
  })
  return { docs: data, error, isLoading }
}

/**
 * The Results sub-tab of Evidence: `evidence/results/`, plus a legacy `index.html`
 * the daemon folds in as "Report". Same lazy rule as Intent, same reason — this is
 * the single largest thing the Evidence canvas reads.
 */
export function useReviewEvidenceDocs(enabled: boolean): {
  docs: IntentDoc[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(reviewEvidenceDocsQuery, project?.path ?? '', {
    enabled: enabled && project !== null,
  })
  return { docs: data, error, isLoading }
}

/**
 * The Assets gallery listing — names, types, sizes, no bytes. Cheap enough to read
 * with the rest of the pack, which is what lets the sub-tab show its count before
 * anyone opens it.
 */
export function useReviewEvidenceAssets(enabled: boolean): {
  assets: EvidenceAsset[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const project = useActiveProject()
  const { data, error, isLoading } = useDaemonQuery(
    reviewEvidenceAssetsQuery,
    project?.path ?? '',
    {
      enabled: enabled && project !== null,
    },
  )
  return { assets: data, error, isLoading }
}

/**
 * One gallery image as a data URL.
 *
 * The heaviest read on this surface and the most granular: a pack can be tens of
 * megabytes, so `enabled` is the Assets sub-tab being up — not the Evidence canvas —
 * and each tile pays only for itself. `null` data is the daemon's per-image cap; the
 * gallery says so from the listing's byte count rather than showing a blank tile.
 */
export function useReviewEvidenceAsset(
  file: string,
  enabled: boolean,
): { asset: EvidenceAssetBody | null | undefined; isLoading: boolean } {
  const project = useActiveProject()
  const { data, isLoading } = useDaemonQuery(
    reviewEvidenceAssetQuery,
    { file, repoPath: project?.path ?? '' },
    { enabled: enabled && project !== null },
  )
  return { asset: data, isLoading }
}

/**
 * What publishing would add to git history. Only read while the confirm dialog is open —
 * it walks the whole active review directory to answer.
 */
export function useReviewPublishCost(enabled: boolean): PublishCost | undefined {
  const project = useActiveProject()
  const { data } = useDaemonQuery(reviewPublishCostQuery, project?.path ?? '', {
    enabled: enabled && project !== null,
  })
  return data
}

/** Previous reviews under `.porcelain/reviews/`, newest first. */
export function useArchivedReviews(active: boolean): ArchivedReview[] {
  const project = useActiveProject()
  const { data } = useDaemonQuery(archivedReviewsQuery, project?.path ?? '', {
    enabled: active && project !== null,
  })
  return data ?? []
}

export type ReviewActions = {
  /** Archive + force-stage for the team. Resolves to the archive id, or null if nothing was active. */
  publish: () => Promise<string | null>
  /** Archive the active unit and empty the slots. */
  archive: () => Promise<void>
  /** Drop the evidence pack, leaving the rest of the review in place. */
  clearEvidence: () => Promise<void>
  isPending: boolean
}

/**
 * The consequential writes: publish, archive, and clear evidence.
 *
 * Invalidate-only, like every other mutation on this seam. An optimistic Review is a web-only
 * idea and a bad one here — the daemon moves directories on disk, and a client that painted
 * the result first would show an archived unit that is still there because the copy failed.
 */
export function useReviewActions(): ReviewActions {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const publish = useDaemonMutation(publishReviewMutation, { invalidates: REVIEW_INVALIDATIONS })
  const archive = useDaemonMutation(clearFeatureReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })
  const clearEvidence = useDaemonMutation(clearLoopEvidenceMutation, {
    invalidates: EVIDENCE_INVALIDATIONS,
  })

  const invalidateComments = async (): Promise<void> => {
    if (!isPaired(environment)) return
    await invalidateAllReviewComments(queryClient, environment.id)
  }

  return {
    archive: async (): Promise<void> => {
      if (project === null) return
      await archive.mutateAsync(project.path)
      await invalidateComments()
    },
    clearEvidence: async (): Promise<void> => {
      if (project === null) return
      await clearEvidence.mutateAsync(project.path)
    },
    isPending: publish.isPending || archive.isPending || clearEvidence.isPending,
    publish: async (): Promise<string | null> => {
      if (project === null) return null
      const result = await publish.mutateAsync(project.path)
      await invalidateComments()
      return result?.id ?? null
    },
  }
}

export type ArchivedReviewActions = {
  restore: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  isPending: boolean
}

/** Promote an archive back to active, or delete it for good. */
export function useArchivedReviewActions(): ArchivedReviewActions {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const restore = useDaemonMutation(restoreArchivedReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })
  const remove = useDaemonMutation(deleteArchivedReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })

  const invalidateComments = async (): Promise<void> => {
    if (!isPaired(environment)) return
    await invalidateAllReviewComments(queryClient, environment.id)
  }

  return {
    isPending: restore.isPending || remove.isPending,
    remove: async (id: string): Promise<void> => {
      if (project === null) return
      await remove.mutateAsync({ id, repoPath: project.path })
      await invalidateComments()
    },
    restore: async (id: string): Promise<void> => {
      if (project === null) return
      await restore.mutateAsync({ id, repoPath: project.path })
      await invalidateComments()
    },
  }
}

import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import type {
  ArchivedReview,
  EvidenceAsset,
  EvidenceAssetBody,
  FeatureReading,
  PublishCost,
  ReviewDoc,
} from '@porcelain/contracts/review'

import { LIVE_POLL_MS } from '@/lib/daemon/poll'

import {
  archivedReviewsProcedure,
  featureReadingProcedure,
  reviewEvidenceAssetProcedure,
  reviewEvidenceAssetsProcedure,
  reviewEvidenceDocsProcedure,
  reviewIntentProcedure,
  reviewPublishCostProcedure,
} from './review-procedures'
import { useReviewQuery, useReviewScope } from './use-review-transport'

/**
 * Every read the Review makes, and the rule each one follows.
 *
 * The rule that matters here is **lazy**: an Intent document set can be 8 MiB and an evidence
 * pack 4 MiB, and neither is worth a byte until the reader is actually on that canvas. So
 * `featureReading` — small, live, and what every other surface derives from — is the only
 * thing that polls, and the heavy reads are gated on their own tab being visible. Fetching
 * them beside the reading "to have them ready" is the one thing that would make this tab
 * expensive to open.
 *
 * Each read is keyed by its semantic Review identity, so a write or a `review.changed`
 * notification names exactly what it made stale — no procedure-name invalidation survives
 * on this surface.
 */

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
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewReadingQuery(scope.projectPath),
    featureReadingProcedure,
    scope.repoPath,
    {
      enabled: active && scope.ready,
      keepPreviousData: true,
      pollMs: LIVE_POLL_MS,
      staleTime: 0,
    },
  )
  return { error, isLoading, reading: data }
}

/**
 * Intent documents. `enabled` is the Intent canvas being on screen, and there is no poll: a
 * document the agent rewrites is picked up by the next mutation invalidation or the next time
 * the tab is opened, which is cheap. Re-reading megabytes every few seconds is not.
 */
export function useReviewIntentDocs(enabled: boolean): {
  docs: ReviewDoc[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewIntentQuery(scope.projectPath),
    reviewIntentProcedure,
    scope.repoPath,
    { enabled: enabled && scope.ready },
  )
  return { docs: data, error, isLoading }
}

/**
 * The Results sub-tab of Evidence: `evidence/results/`, plus a legacy `index.html`
 * the daemon folds in as "Report". Same lazy rule as Intent, same reason — this is
 * the single largest thing the Evidence canvas reads.
 */
export function useReviewEvidenceDocs(enabled: boolean): {
  docs: ReviewDoc[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewEvidenceDocsQuery(scope.projectPath),
    reviewEvidenceDocsProcedure,
    scope.repoPath,
    { enabled: enabled && scope.ready },
  )
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
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewEvidenceAssetsQuery(scope.projectPath),
    reviewEvidenceAssetsProcedure,
    scope.repoPath,
    { enabled: enabled && scope.ready },
  )
  return { assets: data, error, isLoading }
}

/**
 * One gallery image as a data URL.
 *
 * The heaviest read on this surface and the most granular: a pack can be tens of
 * megabytes, so `enabled` is the Assets sub-tab being up — not the Evidence canvas —
 * and each tile pays only for itself. The identity carries the file, so two tiles never
 * share a cache entry. `null` data is the daemon's per-image cap; the gallery says so
 * from the listing's byte count rather than showing a blank tile.
 */
export function useReviewEvidenceAsset(
  file: string,
  enabled: boolean,
): { asset: EvidenceAssetBody | null | undefined; isLoading: boolean } {
  const scope = useReviewScope()
  const { data, isLoading } = useReviewQuery(
    reviewEvidenceAssetQuery(scope.projectPath, file),
    reviewEvidenceAssetProcedure,
    { file, repoPath: scope.repoPath },
    { enabled: enabled && scope.ready },
  )
  return { asset: data, isLoading }
}

/**
 * What publishing would add to git history. Only read while the confirm dialog is open —
 * it walks the whole active review directory to answer.
 */
export function useReviewPublishCost(enabled: boolean): PublishCost | undefined {
  const scope = useReviewScope()
  const { data } = useReviewQuery(
    reviewPublishCostQuery(scope.projectPath),
    reviewPublishCostProcedure,
    scope.repoPath,
    { enabled: enabled && scope.ready },
  )
  return data
}

/** Previous reviews under `.porcelain/reviews/`, newest first. */
export function useArchivedReviews(active: boolean): ArchivedReview[] {
  const scope = useReviewScope()
  const { data } = useReviewQuery(
    reviewArchivedQuery(scope.projectPath),
    archivedReviewsProcedure,
    scope.repoPath,
    { enabled: active && scope.ready },
  )
  return data ?? []
}

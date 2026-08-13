import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceDocQuery,
  reviewEvidenceQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import type {
  ArchivedReview,
  EvidenceAssetBody,
  PublishCost,
  ReviewDoc,
  ReviewEvidence,
  ReviewReading as ReviewReadingDocument,
} from '@porcelain/contracts/review'

import { LIVE_POLL_MS } from '@/lib/daemon/poll'

import {
  archivedReviewsProcedure,
  publishCostProcedure,
  reviewEvidenceAssetProcedure,
  reviewEvidenceDocProcedure,
  reviewEvidenceProcedure,
  reviewIntentProcedure,
  reviewReadingProcedure,
} from './review-procedures'
import { useReviewQuery, useReviewScope } from './use-review-transport'

/**
 * Every read the Review makes, and the rule each one follows.
 *
 * The rule that matters here is **lazy**: an Intent document set can be 8 MiB and an evidence
 * document 2 MiB, and neither is worth a byte until the reader is actually on that canvas. So
 * `reviewReading` — small, live, and what every other surface derives from — is the only
 * thing that polls, and the heavy reads are gated on their own tab being visible. Fetching
 * them beside the reading "to have them ready" is the one thing that would make this tab
 * expensive to open.
 *
 * Each read is keyed by its semantic Review identity, so a write or a `review.changed`
 * notification names exactly what it made stale — no procedure-name invalidation survives
 * on this surface.
 */

export type ReviewReadingResult = {
  /** `undefined` until the first read lands; `null` when there is no active review. */
  reading: ReviewReadingDocument | null | undefined
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
export function useReviewReading(active: boolean): ReviewReadingResult {
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewReadingQuery(scope.projectPath),
    reviewReadingProcedure,
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
 * The whole evidence pack in one read: the checks, the Results document descriptors and the
 * Assets descriptors. No document text and no image bytes travel here, which is what makes a
 * single aggregate cheap enough for the Evidence canvas to open on — the bodies are fetched
 * one at a time by the panes that actually show them.
 */
export function useReviewEvidence(enabled: boolean): {
  evidence: ReviewEvidence | null | undefined
  isLoading: boolean
  error: Error | null
} {
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewEvidenceQuery(scope.projectPath),
    reviewEvidenceProcedure,
    scope.repoPath,
    { enabled: enabled && scope.ready },
  )
  return { error, evidence: data, isLoading }
}

/**
 * One Results document's body, named by its descriptor's file.
 *
 * The identity carries the file, so two documents never share a cache entry, and a pack with
 * five documents costs one document's bytes rather than five.
 */
export function useReviewEvidenceDoc(
  file: string,
  enabled: boolean,
): { doc: ReviewDoc | null | undefined; isLoading: boolean; error: Error | null } {
  const scope = useReviewScope()
  const { data, error, isLoading } = useReviewQuery(
    reviewEvidenceDocQuery(scope.projectPath, file),
    reviewEvidenceDocProcedure,
    { file, repoPath: scope.repoPath },
    { enabled: enabled && scope.ready },
  )
  return { doc: data, error, isLoading }
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
    publishCostProcedure,
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

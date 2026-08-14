import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceDocQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import type {
  ActiveReview,
  ArchivedReview,
  EvidenceAssetBody,
  PublishCost,
  ReviewDoc,
  ReviewEvidence,
  ReviewReading,
} from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useQuery } from '@tanstack/react-query'

import { reviewQueryKey } from './review-query-key'

/**
 * Web Review read adapter (REV-007), following `features/git/git-reads.ts`.
 *
 * Every read is one semantic Review identity keyed as `[typed Review query, DaemonScope]`;
 * no tRPC procedure-name key survives here. The fetch policies are product decisions carried
 * over unchanged from the raw hooks this replaces: the active review and the reading poll
 * every three seconds at `staleTime: 0` because the working tree and the agent channel both
 * change outside the app; the Evidence pack is descriptors only and rides the Review
 * notification; a document body and asset bytes are lazily `enabled` and immutable for a
 * pack; an exploration is a 60-second snapshot of code being read, not of the active review.
 *
 * `reviewed-paths` and `inbox` are Git-keyed by REV-006 and stay in `features/git`.
 */

/** Placeholder path for a disabled query so the key stays a valid Review identity. */
const NO_PROJECT = '/__porcelain-disabled-review__'

function useDaemonScope(): DaemonScope {
  const identity = useDaemonIdentity()
  return { host: identity.host, version: identity.version }
}

/** `active` is `null` when no agent review set exists (the "No review yet" state). */
export function useActiveReview(): {
  active: ActiveReview | null | undefined
  refresh: () => Promise<void>
} {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data: active, refetch } = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.activeReview.query(path),
    queryKey: reviewQueryKey(daemon, reviewActiveQuery(path)),
    refetchInterval: 3000,
    staleTime: 0,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { active, refresh }
}

/**
 * The Review document payload (thesis, walkthrough sections, unanchored groups,
 * evidence meta). `null` means no agent review set — the "No review yet" empty
 * state; `undefined` while loading.
 */
export function useReviewReading(): {
  reading: ReviewReading | null | undefined
  refresh: () => Promise<void>
} {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data: reading, refetch } = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.reviewReading.query(path),
    queryKey: reviewQueryKey(daemon, reviewReadingQuery(path)),
    refetchInterval: 3000,
    staleTime: 0,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { reading, refresh }
}

/** Intent documents the agent wrote under `.porcelain/intent/`, in tab order. */
export function useReviewIntent(): ReviewDoc[] {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data } = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.reviewIntent.query(path),
    queryKey: reviewQueryKey(daemon, reviewIntentQuery(path)),
  })
  return data ?? []
}

/** Bytes and file count publishing the active review would add to git history. */
export function useReviewPublishCost(enabled: boolean): PublishCost | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data } = useQuery({
    enabled: enabled && repoPath !== null,
    queryFn: () => utils.client.publishCost.query(path),
    queryKey: reviewQueryKey(daemon, reviewPublishCostQuery(path)),
  })
  return data
}

/**
 * The one Evidence aggregate: title, timestamp, checks, plus the Results and Assets
 * descriptors. Descriptors only — no document text and no image bytes ride here, so
 * the whole pack is cheap enough to hold and refresh on the Review notification.
 */
export function useReviewEvidence(): ReviewEvidence | null | undefined {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data } = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.reviewEvidence.query(path),
    queryKey: reviewQueryKey(daemon, reviewEvidenceQuery(path)),
  })
  return data
}

/**
 * One Results document body, named by its descriptor `file`. `enabled` is the laziness:
 * a document can be megabytes, so only the visible pill pays for its body. `null` data
 * means over-cap (or vanished); the caller shows the descriptor's size instead.
 */
export function useEvidenceDoc(
  file: string,
  enabled: boolean,
): { doc: ReviewDoc | null | undefined; isLoading: boolean } {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data, isPending } = useQuery({
    enabled: enabled && repoPath !== null,
    queryFn: () => utils.client.reviewEvidenceDoc.query({ file, repoPath: path }),
    queryKey: reviewQueryKey(daemon, reviewEvidenceDocQuery(path, file)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return { doc: data, isLoading: enabled && isPending }
}

/**
 * One gallery image as a data URL. `enabled` is the laziness: a tile's bytes can
 * be megabytes, so the Assets sub-tab passes false until it is the visible pane
 * — nobody pays for a gallery they never open.
 *
 * `staleTime: Infinity` because the bytes are immutable for a given pack; the
 * `evidence-asset-family` effect drops the whole cache entry rather than refetching
 * each tile. `null` data means over-cap (or vanished): the caller shows the listing's size.
 */
export function useEvidenceAsset(
  file: string,
  enabled: boolean,
): { asset: EvidenceAssetBody | null | undefined; isLoading: boolean } {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data, isPending } = useQuery({
    enabled: enabled && repoPath !== null,
    queryFn: () => utils.client.reviewEvidenceAsset.query({ file, repoPath: path }),
    queryKey: reviewQueryKey(daemon, reviewEvidenceAssetQuery(path, file)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return { asset: data, isLoading: enabled && isPending }
}

/** Reviews already archived under `.porcelain/reviews/<id>/`, newest first. */
export function useArchivedReviews(): ArchivedReview[] {
  const repoPath = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath ?? NO_PROJECT
  const { data } = useQuery({
    enabled: repoPath !== null,
    queryFn: () => utils.client.archivedReviews.query(path),
    queryKey: reviewQueryKey(daemon, reviewArchivedQuery(path)),
    refetchInterval: 5000,
    staleTime: 2000,
  })
  return data ?? []
}

/**
 * Read-only exploration seeded from a file (whole-file) or a symbol within it. The
 * result is the same reading-surface payload the review read uses, just derived from an
 * import/reference walk instead of the working tree. A snapshot, not live — exploration
 * is of code you're reading, not changing.
 */
export function useExplore(
  path: string,
  symbol?: string,
): { reading: ReviewReading | undefined; refresh: () => Promise<void> } {
  const checkout = useHubRepoPath()
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const repoPath = checkout ?? NO_PROJECT
  const seed = symbol ? { kind: 'symbol' as const, path, symbol } : { kind: 'file' as const, path }
  const { data: reading, refetch } = useQuery({
    enabled: checkout !== null && path !== '',
    queryFn: () => utils.client.exploreReading.query({ repoPath, seed }),
    queryKey: reviewQueryKey(daemon, reviewExploreQuery(repoPath, seed)),
    staleTime: 60_000,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { reading, refresh }
}

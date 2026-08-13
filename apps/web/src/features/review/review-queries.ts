import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
  reviewViewQuery,
} from '@porcelain/client-runtime/review'
import type {
  ArchivedReview,
  Evidence,
  EvidenceAsset,
  EvidenceAssetBody,
  EvidenceMeta,
  FeatureReading,
  FeatureView,
  PublishCost,
  ReviewDoc,
} from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQuery } from '@tanstack/react-query'

import { reviewQueryKey } from './review-query-key'

/**
 * Web Review read adapter (REV-007), following `features/git/git-reads.ts`.
 *
 * Every read is one semantic Review identity keyed as `[typed Review query, DaemonScope]`;
 * no tRPC procedure-name key survives here. The fetch policies are product decisions carried
 * over unchanged from the five raw hooks this replaces: the view and the reading poll every
 * three seconds at `staleTime: 0` because the working tree and the agent channel both change
 * outside the app; the evidence HTML never polls (up to ~4 MB, refreshed by notification);
 * asset bytes are lazily `enabled` and immutable for a pack; an exploration is a 60-second
 * snapshot of code being read, not of the active review.
 *
 * `reviewed-paths` and `worktree-inbox` are Git-keyed by REV-006 and stay in `features/git`.
 */

/** Placeholder path for a disabled query so the key stays a valid Review identity. */
const NO_PROJECT = '/__porcelain-disabled-review__'

function useDaemonScope(): DaemonScope {
  const identity = useDaemonIdentity()
  return { host: identity.host, version: identity.version }
}

/** `view` is `null` when no agent review set exists (the "No review yet" state). */
export function useReviewView(): {
  view: FeatureView | null | undefined
  refresh: () => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data: view, refetch } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.featureView.query(path),
    queryKey: reviewQueryKey(daemon, reviewViewQuery(path)),
    refetchInterval: 3000,
    staleTime: 0,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { refresh, view }
}

/**
 * The Review document payload (thesis, walkthrough sections, unanchored groups,
 * evidence meta). `null` means no agent review set — the "No review yet" empty
 * state; `undefined` while loading.
 */
export function useReviewReading(): {
  reading: FeatureReading | null | undefined
  refresh: () => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data: reading, refetch } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.featureReading.query(path),
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
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.reviewIntent.query(path),
    queryKey: reviewQueryKey(daemon, reviewIntentQuery(path)),
  })
  return data ?? []
}

/** Extra evidence documents beside index.html — tabs, same media as Intent. */
export function useReviewEvidenceDocs(): ReviewDoc[] {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.reviewEvidenceDocs.query(path),
    queryKey: reviewQueryKey(daemon, reviewEvidenceDocsQuery(path)),
  })
  return data ?? []
}

/** Bytes and file count publishing the active review would add to git history. */
export function useReviewPublishCost(enabled: boolean): PublishCost | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: enabled && project !== null,
    queryFn: () => utils.client.reviewPublishCost.query(path),
    queryKey: reviewQueryKey(daemon, reviewPublishCostQuery(path)),
  })
  return data
}

/** Loop-evidence metadata (title, timestamp, checks) for the active review. */
export function useReviewEvidence(): EvidenceMeta | null | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.loopEvidence.query(path),
    queryKey: reviewQueryKey(daemon, reviewEvidenceQuery(path)),
  })
  return data
}

/**
 * The full evidence document for a project — read only while the Review's evidence
 * chapter is on screen. No poll: it's a static document, and the Review notification
 * refreshes it live on a CLI write; polling the (up to ~4 MB) HTML on a timer would be
 * wasteful. (Chapter presence/meta rides on the reading.)
 */
export function useEvidenceHtml(repoPath: string): { evidence: Evidence | null | undefined } {
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = repoPath === '' ? NO_PROJECT : repoPath
  const { data: evidence } = useQuery({
    enabled: repoPath !== '',
    queryFn: () => utils.client.loopEvidenceHtml.query(path),
    queryKey: reviewQueryKey(daemon, reviewEvidenceHtmlQuery(path)),
    staleTime: 0,
  })
  return { evidence }
}

/**
 * The Assets sub-tab's listing — metadata only (file, label, mime, bytes), never
 * bytes. Cheap enough to hold with the rest of the pack and refreshed by the Review
 * notification when the agent rewrites the directory.
 */
export function useEvidenceAssets(): EvidenceAsset[] {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.reviewEvidenceAssets.query(path),
    queryKey: reviewQueryKey(daemon, reviewEvidenceAssetsQuery(path)),
  })
  return data ?? []
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
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data, isPending } = useQuery({
    enabled: enabled && project !== null,
    queryFn: () => utils.client.reviewEvidenceAsset.query({ file, repoPath: path }),
    queryKey: reviewQueryKey(daemon, reviewEvidenceAssetQuery(path, file)),
    staleTime: Number.POSITIVE_INFINITY,
  })
  return { asset: data, isLoading: enabled && isPending }
}

/** Reviews already archived under `.porcelain/reviews/<id>/`, newest first. */
export function useArchivedReviews(): ArchivedReview[] {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const path = project?.path ?? NO_PROJECT
  const { data } = useQuery({
    enabled: project !== null,
    queryFn: () => utils.client.archivedReviews.query(path),
    queryKey: reviewQueryKey(daemon, reviewArchivedQuery(path)),
    refetchInterval: 5000,
    staleTime: 2000,
  })
  return data ?? []
}

/**
 * Read-only feature-flow exploration seeded from a file (whole-file) or a symbol
 * within it. The result is the same reading-surface payload the review read uses, just
 * derived from an import/reference walk instead of the working tree. A snapshot, not
 * live — exploration is of code you're reading, not changing.
 */
export function useExplore(
  path: string,
  symbol?: string,
): { reading: FeatureReading | undefined; refresh: () => Promise<void> } {
  const project = useProjectSelectionStore((s) => s.project)
  const daemon = useDaemonScope()
  const utils = trpc.useUtils()
  const repoPath = project?.path ?? NO_PROJECT
  const seed = symbol ? { kind: 'symbol' as const, path, symbol } : { kind: 'file' as const, path }
  const { data: reading, refetch } = useQuery({
    enabled: project !== null && path !== '',
    queryFn: () => utils.client.exploreFeature.query({ repoPath, seed }),
    queryKey: reviewQueryKey(daemon, reviewExploreQuery(repoPath, seed)),
    staleTime: 60_000,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { reading, refresh }
}

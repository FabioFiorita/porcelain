import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import {
  type ArchivedReview,
  archivedReviewsQuery,
  clearFeatureReviewMutation,
  clearLoopEvidenceMutation,
  deleteArchivedReviewMutation,
  type Evidence,
  type FeatureReading,
  featureReadingQuery,
  type IntentDoc,
  loopEvidenceHtmlQuery,
  type PublishCost,
  publishReviewMutation,
  restoreArchivedReviewMutation,
  reviewEvidenceDocsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

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
  'reviewPublishCost',
  'loopEvidence',
  'loopEvidenceHtml',
  'reviewComments',
  'reviewedPaths',
  'archivedReviews',
] as const

/** Clearing evidence leaves the review alone; only the proof and its chapter move. */
const EVIDENCE_INVALIDATIONS = [
  'featureReading',
  'loopEvidence',
  'loopEvidenceHtml',
  'reviewEvidenceDocs',
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
  const repo = useActiveRepo()
  const { data, error, isLoading } = useDaemonQuery(featureReadingQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
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
  const repo = useActiveRepo()
  const { data, error, isLoading } = useDaemonQuery(reviewIntentQuery, repo?.path ?? '', {
    enabled: enabled && repo !== null,
  })
  return { docs: data, error, isLoading }
}

/** Extra evidence documents beside the report. Same lazy rule, same reason. */
export function useReviewEvidenceDocs(enabled: boolean): {
  docs: IntentDoc[] | undefined
  isLoading: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const { data, error, isLoading } = useDaemonQuery(reviewEvidenceDocsQuery, repo?.path ?? '', {
    enabled: enabled && repo !== null,
  })
  return { docs: data, error, isLoading }
}

/**
 * The evidence HTML itself — the single largest thing this client ever reads. Gated on the
 * Evidence canvas being up, never polled, never fetched beside the reading.
 */
export function useEvidenceHtml(enabled: boolean): {
  evidence: Evidence | null | undefined
  isLoading: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const { data, error, isLoading } = useDaemonQuery(loopEvidenceHtmlQuery, repo?.path ?? '', {
    enabled: enabled && repo !== null,
  })
  return { error, evidence: data, isLoading }
}

/**
 * What publishing would add to git history. Only read while the confirm dialog is open —
 * it walks the whole active review directory to answer.
 */
export function useReviewPublishCost(enabled: boolean): PublishCost | undefined {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(reviewPublishCostQuery, repo?.path ?? '', {
    enabled: enabled && repo !== null,
  })
  return data
}

/** Previous reviews under `.porcelain/reviews/`, newest first. */
export function useArchivedReviews(active: boolean): ArchivedReview[] {
  const repo = useActiveRepo()
  const { data } = useDaemonQuery(archivedReviewsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
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
  const repo = useActiveRepo()
  const publish = useDaemonMutation(publishReviewMutation, { invalidates: REVIEW_INVALIDATIONS })
  const archive = useDaemonMutation(clearFeatureReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })
  const clearEvidence = useDaemonMutation(clearLoopEvidenceMutation, {
    invalidates: EVIDENCE_INVALIDATIONS,
  })

  return {
    archive: async (): Promise<void> => {
      if (repo === null) return
      await archive.mutateAsync(repo.path)
    },
    clearEvidence: async (): Promise<void> => {
      if (repo === null) return
      await clearEvidence.mutateAsync(repo.path)
    },
    isPending: publish.isPending || archive.isPending || clearEvidence.isPending,
    publish: async (): Promise<string | null> => {
      if (repo === null) return null
      const result = await publish.mutateAsync(repo.path)
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
  const repo = useActiveRepo()
  const restore = useDaemonMutation(restoreArchivedReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })
  const remove = useDaemonMutation(deleteArchivedReviewMutation, {
    invalidates: REVIEW_INVALIDATIONS,
  })

  return {
    isPending: restore.isPending || remove.isPending,
    remove: async (id: string): Promise<void> => {
      if (repo === null) return
      await remove.mutateAsync({ id, repoPath: repo.path })
    },
    restore: async (id: string): Promise<void> => {
      if (repo === null) return
      await restore.mutateAsync({ id, repoPath: repo.path })
    },
  }
}

import type { ReviewUnavailableError } from './comment-capabilities'

/**
 * Review lifecycle ports: archiving, publishing, listing, restoring, and deleting
 * the project's reviews. Error shapes stay local to the domain; the only expected
 * failure here is an unusable host (`review.unavailable`), exactly as the comment
 * slice declares it.
 */

export type ArchivedReviewMeta = {
  id: string
  name: string
  thesis?: string
  archivedAt: string
}

export type ReviewPublishCost = { bytes: number; files: number }

export type ReviewPublishOutcome = { id: string; cost: ReviewPublishCost }

export type ReviewLifecycleResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReviewUnavailableError }

/** Active-review directory and `.porcelain/reviews/<id>/` effects. */
export type ReviewArchiveStore = {
  /** Copy the active review to a new archive and clear the active slots; null when nothing is active. */
  archiveActive(repoPath: string, id: string, archivedAt: string): Promise<string | null>
  /** Recursive byte/file cost of the active review; a missing directory is zero. */
  activeCost(repoPath: string): Promise<ReviewPublishCost>
  /** Newest first; unreadable or contract-violating `meta.json` entries are skipped. */
  list(repoPath: string): Promise<ArchivedReviewMeta[]>
  /** Is this archive there to restore? Asked before a restore archives anything. */
  has(repoPath: string, id: string): Promise<boolean>
  restore(repoPath: string, id: string): Promise<void>
  remove(repoPath: string, id: string): Promise<void>
  /** Relative path of an archive inside the repo, for publication staging. */
  archiveRelativePath(repoPath: string, id: string): string
}

/** The product's only force-stage, plus its durable gitignore negation. */
export type ReviewPublication = {
  recordPublished(repoPath: string, id: string): Promise<void>
  forceStage(repoPath: string, relativePath: string): Promise<void>
}

export type ReviewClock = { now(): number }
export type ReviewArchiveIds = { create(): string }

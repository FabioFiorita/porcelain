/**
 * Reviewed-marks ports: the per-file "I have read this" marks for the active review
 * — `<repo>/.porcelain/reviewed.json`, ONE-WAY app→agent.
 *
 * A mark stores a content fingerprint so it can be reconciled: the reader re-derives
 * each marked file's current fingerprint and prunes any mark whose content changed
 * (external commit, amend, post-mark edit). Neither intention has an expected typed
 * failure — a missing file is an empty mark set, and a genuine Git or filesystem
 * failure propagates and serializes as `internal.unexpected`.
 */

/** One reviewed file and the content fingerprint the mark was taken at. */
export type ReviewedMark = {
  path: string
  fingerprint: string
  /** Absent on marks written before scoped review; those belong to the working tree. */
  scope?: ReviewedScope
}

/** The single owner of `reviewed.json`. No caller sees a host path. */
export type ReviewMarksStore = Readonly<{
  /** Every mark currently on disk, in write order. */
  read(repoPath: string): Promise<ReviewedMark[]>
  /** Replace the whole set, de-duplicated by path. */
  write(repoPath: string, marks: readonly ReviewedMark[]): Promise<void>
  /**
   * Remove exactly the named marks, read-modify-write, so a mark another writer
   * added between the snapshot and the prune survives.
   */
  remove(repoPath: string, marks: readonly ReviewedMark[]): Promise<void>
}>

/** The narrow Git fact reviewed marks need; no argv and no Git algorithm crosses it. */
export type ReviewMarksGit = Readonly<{
  /**
   * Content fingerprints for exactly these paths, batched at a constant spawn count
   * — the reconcile polls it every few seconds.
   */
  fingerprints(
    repoPath: string,
    paths: readonly string[],
    scope: ReviewedScope,
  ): Promise<Map<string, string>>
}>
import type { ReviewedScope } from '@porcelain/contracts/review'
export type { ReviewedScope } from '@porcelain/contracts/review'

import type { ChangedFile, DiffHunk, DiffStat, Worktree } from '../../git/diff'
import type { ActiveReview, ReviewReading } from '../../review/active-review'
import type { ReviewDoc } from '../../review/doc-set'
import type { Layer } from '../../review/flow'
import type { ReviewSet } from '../../review/review-set'

/**
 * Review reading ports: the active review, its document, the read-only exploration
 * walk, and the Review inbox. None of these intentions has an expected typed
 * failure — "no active review" is `null`, a vanished file is an empty hunk list, a
 * broken sibling worktree is a dropped row — so no error shape is declared here and
 * an adapter failure propagates exactly as it does today.
 *
 * The shapes reuse the pure reading modules rather than restating them: those
 * builders are shared with Git and stay where they are.
 */

/** The cheap phase both reading intentions share: snapshot + layers + set → memo key. */
export type ReviewGatherState = {
  files: ChangedFile[]
  stats: DiffStat[]
  layers: Layer[]
  reviewSet: ReviewSet | null
  key: string
}

/** The expensive phase's memoized result: the view plus the sources it read. */
export type ReviewBuiltReview = {
  key: string
  view: ActiveReview
  sources: Map<string, string>
}

/** The Evidence chapter descriptor, exactly as the reading surface carries it. */
export type ReviewEvidenceSummary = NonNullable<ReviewReading['evidence']>

/**
 * One Review-inbox row: a SIBLING worktree of the current checkout that has work awaiting
 * review. Assembled per-worktree from the family list, its changed-file count, and whether
 * a Review set was pushed for it.
 */
export type InboxRow = {
  path: string
  branch: string
  /** Number of changed files in that worktree's working tree. */
  changedCount: number
  /** True when the agent pushed a Review set for that worktree's path. */
  hasReview: boolean
}

/** The memoized review-set build: snapshot + layers + set → key, then view/sources. */
export type ReviewReadingSources = Readonly<{
  gather(repoPath: string): Promise<ReviewGatherState>
  build(
    repoPath: string,
    gathered: ReviewGatherState & { reviewSet: ReviewSet },
  ): Promise<ReviewBuiltReview>
  cachedReading(repoPath: string, key: string): ReviewReading | null
  storeReading(repoPath: string, key: string, reading: ReviewReading): void
  /** A review set exists for that checkout — the inbox's only review signal. */
  hasReviewSet(repoPath: string): Promise<boolean>
}>

/** The narrow Git facts Review reading needs; no argv and no Git algorithm crosses it. */
export type ReviewGit = Readonly<{
  fileHunks(repoPath: string, path: string): Promise<DiffHunk[]>
  listFiles(repoPath: string): Promise<string[]>
  worktrees(repoPath: string): Promise<Worktree[]>
  changedCount(repoPath: string): Promise<number>
}>

/** Bounded working-tree source text; an unreadable or oversized file is `undefined`. */
export type ReviewFiles = Readonly<{
  readSource(repoPath: string, path: string): Promise<string | undefined>
}>

/** The Evidence chapter's current descriptor, read fresh outside the review key. */
export type ReviewEvidence = Readonly<{
  readSummary(repoPath: string): Promise<ReviewEvidenceSummary | null>
}>

/** The Intent document set — the first reading of the Review canvas. */
export type ReviewIntent = Readonly<{
  readDocs(repoPath: string): Promise<ReviewDoc[]>
}>

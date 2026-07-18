import { z } from 'zod'
import { loadConfig } from './config-store'
import { createHomeChannel } from './home-channel'

/**
 * The reviewed-marks channel: the repo-relative file paths the human has checked off
 * as reviewed in Porcelain (the per-file marks in the Changes / Feature lists), keyed
 * by absolute repo path, in `~/.porcelain/reviewed.json` (same fixed home-dir rationale
 * as the review-set / comment / board / notes channels — a plain `node` CLI process
 * can't resolve userData). ONE-WAY, app→agent: only the app writes (the human marks
 * files reviewed); the porcelain CLI (src/cli/reviewed-file.ts) only reads them, so the
 * agent knows what the human has already vetted. Like notes, the app is the SOLE
 * writer — there is no review-watch entry and no write tool, nothing pushes back.
 * Atomic (tmp + rename) + in-process-serialized writes.
 *
 * A mark is `{ path, fingerprint }` — the fingerprint (computed by the caller in
 * api.ts via `reviewedFingerprint`) identifies the CONTENT that was reviewed (a sha256
 * of the file's diff vs HEAD). At read time api.ts reconciles: a mark whose stored
 * fingerprint no longer matches the file's current diff hash is pruned (silently
 * un-ticked), so external commits, amends, rebases, and post-mark edits all clear stale
 * ticks with no watcher or commit hook. `gitCommit` still clears committed files' marks
 * as a fast path. Legacy plain-string marks are still accepted on read (as `{ path,
 * fingerprint: '' }`); an empty fingerprint never matches, so a legacy mark prunes on
 * its first reconcile (a one-time silent un-tick, acceptable). Marks lived in
 * userData/config.json (`config.repos[*].reviewedPaths`) until they moved here so the
 * CLI could read them (see migrateReviewedFromConfig).
 */
const reviewedMarkSchema = z.object({ path: z.string(), fingerprint: z.string() })
export type ReviewedMark = z.infer<typeof reviewedMarkSchema>

// Accept the current object shape AND legacy plain strings, normalizing a bare string
// to a fingerprint-less mark (which always reconciles as stale).
const reviewedEntrySchema = z.union([
  reviewedMarkSchema,
  z.string().transform((path): ReviewedMark => ({ path, fingerprint: '' })),
])
export const reviewedSchema = z.record(z.string(), z.array(reviewedEntrySchema))
export type Reviewed = z.infer<typeof reviewedSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_REVIEWED',
  fileName: 'reviewed.json',
  schema: reviewedSchema,
  empty: (): Reviewed => ({}),
})

// Must match src/cli/reviewed-file.ts. PORCELAIN_REVIEWED redirects both sides for tests.
export const reviewedPath = channel.path

// Drop an emptied entry so the file stays tidy (matches notes/layers).
function setMarks(all: Reviewed, repoPath: string, marks: ReviewedMark[]): void {
  if (marks.length === 0) delete all[repoPath]
  else all[repoPath] = marks
}

// Collapse duplicate paths (last wins, so a re-mark's newer fingerprint sticks).
function dedupeByPath(marks: ReviewedMark[]): ReviewedMark[] {
  return [...new Map(marks.map((m) => [m.path, m])).values()]
}

/** The full reviewed marks (path + fingerprint) for a repo ([] when none / file absent). */
export async function readReviewedMarks(repoPath: string): Promise<ReviewedMark[]> {
  return (await channel.readAll())[repoPath] ?? []
}

/** The repo-relative paths the human has marked reviewed ([] when none / file absent). */
export async function readReviewedPaths(repoPath: string): Promise<string[]> {
  return (await readReviewedMarks(repoPath)).map((m) => m.path)
}

/** Mark a path reviewed with its content fingerprint (a re-mark refreshes the fingerprint). */
export async function markReviewed(
  repoPath: string,
  path: string,
  fingerprint: string,
): Promise<void> {
  await channel.mutate((all) => {
    const others = (all[repoPath] ?? []).filter((m) => m.path !== path)
    setMarks(all, repoPath, [...others, { path, fingerprint }])
  })
}

/** Unmark a path (no-op when it wasn't reviewed). */
export async function unmarkReviewed(repoPath: string, path: string): Promise<void> {
  await channel.mutate((all) => {
    const current = all[repoPath]
    if (!current) return
    setMarks(
      all,
      repoPath,
      current.filter((m) => m.path !== path),
    )
  })
}

/** Drop many marks at once (the files just committed — their marks no longer apply). */
export async function clearReviewedPaths(repoPath: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await channel.mutate((all) => {
    const current = all[repoPath]
    if (!current) return
    const removed = new Set(paths)
    setMarks(
      all,
      repoPath,
      current.filter((m) => !removed.has(m.path)),
    )
  })
}

/**
 * Replace a repo's reviewed marks wholesale — the header "mark all / unmark all" toggle.
 * An empty list clears the repo's entry (unmark all); duplicate paths are collapsed.
 */
export async function setReviewedMarks(repoPath: string, marks: ReviewedMark[]): Promise<void> {
  await channel.mutate((all) => {
    setMarks(all, repoPath, dedupeByPath(marks))
  })
}

/**
 * Pure reconcile: keep a mark when its stored fingerprint still matches the current one
 * for its path. A path ABSENT from `currentFingerprints` means "not fingerprinted this
 * round" — NOT "stale" — so a non-legacy absent mark is kept, never pruned (this is what
 * lets a mark added concurrently, after the snapshot the fingerprints were computed for,
 * survive). A legacy mark (empty stored fingerprint) still always prunes. Reports whether
 * anything was pruned so the caller can skip the write when nothing changed.
 */
export function reconcileMarks(
  marks: ReviewedMark[],
  currentFingerprints: Map<string, string>,
): { marks: ReviewedMark[]; pruned: boolean } {
  const survivors = marks.filter((m) => {
    if (m.fingerprint === '') return false // legacy mark: always prune
    const current = currentFingerprints.get(m.path)
    return current === undefined || current === m.fingerprint // absent = keep, present = match
  })
  return { marks: survivors, pruned: survivors.length !== marks.length }
}

/**
 * Reconcile a repo's marks against the fingerprints freshly computed for a SNAPSHOT of
 * those marks — the caller in api.ts reads the marks, then fingerprints exactly those
 * paths. Pass that same snapshot in; this does NOT re-read the marks for the prune
 * decision, so a mark added between the snapshot and this serialized write (a new path,
 * or a re-mark with a fresh fingerprint) is never in the snapshot, is never classed
 * stale, and survives untouched. Writes through only when something in the snapshot was
 * pruned (so the JSON stays truthful for the CLI reader without a needless rewrite).
 *
 * Returns the on-disk paths AFTER reconcile (re-read), not just the snapshot survivors —
 * so a concurrent `markReviewed` that landed while we were fingerprinting is included in
 * the response. Returning only the snapshot used to make the client poll overwrite an
 * optimistic tick with a pre-mark list, and the mark appeared to "un-toggle" a moment later.
 */
export async function reconcileReviewed(
  repoPath: string,
  snapshotMarks: ReviewedMark[],
  currentFingerprints: Map<string, string>,
): Promise<string[]> {
  const { marks: survivors, pruned } = reconcileMarks(snapshotMarks, currentFingerprints)
  if (pruned) {
    // Delete only the exact (path, fingerprint) pairs found stale IN THE SNAPSHOT — so a
    // mark or re-mark added (different path, or same path with a fresh fingerprint)
    // between the snapshot and this serialized write is never in the stale set and stays.
    const stale = new Set(
      snapshotMarks.filter((m) => !survivors.includes(m)).map((m) => `${m.path}\0${m.fingerprint}`),
    )
    await channel.mutate((all) => {
      setMarks(
        all,
        repoPath,
        (all[repoPath] ?? []).filter((m) => !stale.has(`${m.path}\0${m.fingerprint}`)),
      )
    })
  }
  return readReviewedPaths(repoPath)
}

/**
 * One-time migration: reviewed marks used to live in userData/config.json
 * (`config.repos[*].reviewedPaths`). Copy any non-empty legacy marks into reviewed.json
 * so the CLI — which can't resolve userData — can serve them. The legacy strings carry
 * no content fingerprint, so they land as `{ path, fingerprint: '' }` and prune on their
 * first reconcile (a one-time silent un-tick). Idempotent: only fills a repo whose
 * reviewed.json entry is absent, so it no-ops once migrated and never clobbers a newer
 * in-app mark. Runs at startup, before any window reads the marks.
 */
export async function migrateReviewedFromConfig(): Promise<void> {
  const config = await loadConfig()
  const legacy = Object.entries(config.repos).filter(([, repo]) => repo.reviewedPaths?.length)
  if (legacy.length === 0) return
  await channel.mutate((all) => {
    for (const [repoPath, repo] of legacy) {
      if (all[repoPath] === undefined && repo.reviewedPaths?.length) {
        all[repoPath] = repo.reviewedPaths.map((path) => ({ path, fingerprint: '' }))
      }
    }
  })
}

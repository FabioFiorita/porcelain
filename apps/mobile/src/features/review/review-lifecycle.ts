import type { FeatureReading, FileSource, ReadingFile } from '@/lib/daemon/procedures/review'

/**
 * Shape helpers for the one active Review story of a repo — the twin of the web client's
 * `lib/review-lifecycle.ts`. The lifecycle itself — start, continue, close — is agent-side;
 * the app only reads what was published, so what is left here is pure, DOM-free counting that
 * both clients must agree on for the same `.porcelain/review.json`.
 */

/** Unique files across sections + more-files groups. */
export function reviewOutlineFiles(reading: FeatureReading): ReadingFile[] {
  const seen = new Set<string>()
  const out: ReadingFile[] = []
  for (const file of [
    ...reading.sections.flatMap((s) => s.files),
    ...reading.groups.flatMap((g) => g.files),
  ]) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    out.push(file)
  }
  return out
}

/**
 * Unique-file counts per source, for the canvas legend.
 *
 * Counted off the deduped outline for the same reason the reviewed fraction is: a file the
 * agent anchored to a section AND left in a group is one file, and counting it twice would
 * make this legend disagree with the desktop's for the same repo.
 */
export function reviewSourceCounts(reading: FeatureReading): Record<FileSource, number> {
  const counts: Record<FileSource, number> = { changed: 0, context: 0, shipped: 0 }
  for (const file of reviewOutlineFiles(reading)) counts[file.source] += 1
  return counts
}

/** The share of the outline that has been ticked off. */
export function reviewedFractionOf(
  reading: FeatureReading,
  reviewed: ReadonlySet<string>,
): { fraction: number; reviewedCount: number; total: number } {
  const outline = reviewOutlineFiles(reading)
  const reviewedCount = outline.filter((file) => reviewed.has(file.path)).length
  return {
    fraction: outline.length === 0 ? 0 : reviewedCount / outline.length,
    reviewedCount,
    total: outline.length,
  }
}

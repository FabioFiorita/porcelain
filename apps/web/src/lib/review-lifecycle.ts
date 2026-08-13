import type { ReadingFile, ReviewReading } from '@porcelain/contracts/review'

/**
 * Shape helpers for the one active Review story of a repo. The lifecycle itself
 * — start, continue, close — is agent-side; the app only reads what was published.
 */

/** Unique files across sections + more-files groups. */
export function reviewOutlineFiles(reading: ReviewReading): ReadingFile[] {
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

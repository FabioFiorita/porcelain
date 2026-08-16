import type { ReadingFile, ReviewReading } from '@porcelain/contracts/review'

/**
 * Shape helpers for the Review Canvas outline.
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

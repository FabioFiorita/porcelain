import type { ReadingFile } from '@backend/feature-view'

/** Inclusive 1-based line range to tint in the file viewer. */
export interface HighlightRange {
  start: number
  end: number
}

/**
 * Agent-changed line ranges for a Feature-outline file open.
 * Changed files: union of each hunk's new-side **add** lines, coalesced into
 * contiguous ranges. Other sources → undefined (no tint). When `lineCount` is
 * given and coverage is ≥90% (typical untracked whole-file hunk), skip the tint
 * so the whole file isn't painted green noise — caller still scrolls to top.
 */
export function highlightRangesForFile(
  file: ReadingFile,
  lineCount?: number,
): HighlightRange[] | undefined {
  if (file.source !== 'changed' || !file.hunks || file.hunks.length === 0) return undefined

  const lines: number[] = []
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add' && line.newLine !== null) lines.push(line.newLine)
    }
  }
  if (lines.length === 0) return undefined

  lines.sort((a, b) => a - b)
  const ranges: HighlightRange[] = []
  let start = lines[0]
  let end = lines[0]
  if (start === undefined || end === undefined) return undefined

  for (let i = 1; i < lines.length; i++) {
    const n = lines[i]
    if (n === undefined) continue
    if (n <= end + 1) {
      end = n
    } else {
      ranges.push({ start, end })
      start = n
      end = n
    }
  }
  ranges.push({ start, end })

  if (lineCount !== undefined && lineCount > 0) {
    let covered = 0
    for (const range of ranges) {
      covered += range.end - range.start + 1
    }
    if (covered / lineCount >= 0.9) return undefined
  }

  return ranges
}

/** Whether a 1-based line falls in any inclusive highlight range. */
export function lineInHighlightRanges(
  line: number,
  ranges: readonly HighlightRange[] | undefined,
): boolean {
  if (!ranges || ranges.length === 0) return false
  return ranges.some((r) => line >= r.start && line <= r.end)
}

/** Inclusive 1-based line range to tint in the file viewer. */
export interface HighlightRange {
  start: number
  end: number
}

/** Whether a 1-based line falls in any inclusive highlight range. */
export function lineInHighlightRanges(
  line: number,
  ranges: readonly HighlightRange[] | undefined,
): boolean {
  if (!ranges || ranges.length === 0) return false
  return ranges.some((r) => line >= r.start && line <= r.end)
}

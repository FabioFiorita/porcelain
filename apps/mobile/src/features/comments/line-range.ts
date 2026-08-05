/**
 * An in-progress line selection: the line it was anchored on and the line it currently
 * reaches. Kept as anchor/focus rather than start/end so extending backwards past the
 * anchor works without the range flipping inside out.
 *
 * Deliberately free of any diff or file model — a diff row, a source line, and a future
 * commit view all anchor a comment the same way, and only the surface knows how to turn a
 * range back into quoted text.
 */
export type LineSelection = {
  /** Repo-relative path. A selection never spans two files. */
  path: string
  anchor: number
  focus: number
}

export type LineRange = { startLine: number; endLine: number }

/** The ordered range a selection covers. */
export function rangeOf(selection: LineSelection): LineRange {
  return {
    endLine: Math.max(selection.anchor, selection.focus),
    startLine: Math.min(selection.anchor, selection.focus),
  }
}

/** The selection's range, but only for the file being rendered — null for any other. */
export function rangeForPath(selection: LineSelection | null, path: string): LineRange | null {
  return selection === null || selection.path !== path ? null : rangeOf(selection)
}

export function isLineInRange(range: LineRange | null, line: number | undefined): boolean {
  return range !== null && line !== undefined && line >= range.startLine && line <= range.endLine
}

/** Anchor text is best-effort context for the agent, not the file — cap it like web does. */
export const MAX_ANCHOR_TEXT = 2_000

/** "Line 12" / "Lines 12–18" — what the selection bar offers to comment on. */
export function describeRange(range: LineRange): string {
  return range.startLine === range.endLine
    ? `Line ${range.startLine}`
    : `Lines ${range.startLine}–${range.endLine}`
}

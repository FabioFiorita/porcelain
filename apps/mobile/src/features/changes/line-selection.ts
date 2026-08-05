import type { DiffHunk } from '@/lib/daemon/procedures/changes'

import { anchorLineOf } from './diff-rows'

/**
 * An in-progress line selection: the line it was anchored on and the line it currently
 * reaches. Kept as anchor/focus rather than start/end so extending backwards past the
 * anchor works without the range flipping inside out.
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
const MAX_ANCHOR_TEXT = 2_000

/**
 * The source the selected lines quote, for the comment's anchor text.
 *
 * Selects on the same predicate the rows tint with (`anchorLineOf` inside the range), so what
 * the reader sees highlighted is exactly what the agent is quoted — a diff line that anchors
 * nowhere is neither tinted nor quoted.
 */
export function anchorTextFor(hunks: readonly DiffHunk[], range: LineRange): string {
  const lines: string[] = []
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (isLineInRange(range, anchorLineOf(line))) lines.push(line.text)
    }
  }
  return lines.join('\n').slice(0, MAX_ANCHOR_TEXT)
}

/** "Line 12" / "Lines 12–18" — what the selection bar offers to comment on. */
export function describeRange(range: LineRange): string {
  return range.startLine === range.endLine
    ? `Line ${range.startLine}`
    : `Lines ${range.startLine}–${range.endLine}`
}

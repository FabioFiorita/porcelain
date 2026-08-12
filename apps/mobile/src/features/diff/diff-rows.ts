import type { DiffHunk } from '@porcelain/contracts/git'

import { isLineInRange, type LineRange, MAX_ANCHOR_TEXT } from '../comments/line-range'

type DiffLine = DiffHunk['lines'][number]

export type DiffMode = 'unified' | 'split'

/**
 * One rendered row of a diff. Flattening hunks to rows up front is what lets the viewer
 * hand a single flat list to a virtualized `FlatList` — the alternative, a nested
 * hunk→line render, forces the whole file into memory on mount.
 */
export type DiffRow =
  | { kind: 'header'; key: string; text: string }
  | { kind: 'unified'; key: string; line: DiffLine }
  | { kind: 'split'; key: string; left: DiffLine | null; right: DiffLine | null }

/**
 * The line a row's comments anchor to. Comments live on the NEW side, so a row's anchor is
 * its new-side number, falling back to the old side for a pure deletion (which has none).
 */
export function anchorLineOf(line: DiffLine): number | undefined {
  return line.newLine ?? line.oldLine ?? undefined
}

/**
 * The commentable line a split cell owns. The new side owns adds and context; the old side
 * owns only pure deletions, so a context line is anchored once — on the new side.
 */
export function cellAnchorLine(line: DiffLine, side: 'left' | 'right'): number | undefined {
  if (side === 'right') return line.newLine ?? undefined
  return line.kind === 'del' ? (line.oldLine ?? undefined) : undefined
}

/**
 * Pair deletions with the additions that replace them, GitHub-Desktop style: consecutive
 * deletions queue up and each following addition claims one, so a rewritten line shows old
 * and new beside each other. Unclaimed deletions flush as left-only rows.
 */
function toSplitRows(hunk: DiffHunk): { left: DiffLine | null; right: DiffLine | null }[] {
  const rows: { left: DiffLine | null; right: DiffLine | null }[] = []
  let pendingDels: DiffLine[] = []

  const flush = (): void => {
    for (const del of pendingDels) rows.push({ left: del, right: null })
    pendingDels = []
  }

  for (const line of hunk.lines) {
    if (line.kind === 'del') {
      pendingDels.push(line)
    } else if (line.kind === 'add') {
      const del = pendingDels.shift()
      rows.push({ left: del ?? null, right: line })
    } else {
      flush()
      rows.push({ left: line, right: line })
    }
  }
  flush()
  return rows
}

/**
 * Flatten hunks into the rows the viewer renders, in either layout.
 *
 * Keys are positional (`hunk index` + `row index`) rather than line numbers: a diff has
 * repeated line numbers across hunks, and a null-numbered padding cell has none at all.
 */
export function toDiffRows(hunks: readonly DiffHunk[], mode: DiffMode): DiffRow[] {
  const rows: DiffRow[] = []
  hunks.forEach((hunk, hunkIndex) => {
    rows.push({ key: `h${hunkIndex}`, kind: 'header', text: hunk.header })
    if (mode === 'unified') {
      hunk.lines.forEach((line, lineIndex) => {
        rows.push({ key: `h${hunkIndex}:${lineIndex}`, kind: 'unified', line })
      })
      return
    }
    toSplitRows(hunk).forEach((row, rowIndex) => {
      rows.push({
        key: `h${hunkIndex}:${rowIndex}`,
        kind: 'split',
        left: row.left,
        right: row.right,
      })
    })
  })
  return rows
}

/**
 * The source the selected lines quote, for the comment's anchor text.
 *
 * Selects on the same predicate the rows tint with (`anchorLineOf` inside the range), so what
 * the reader sees highlighted is exactly what the agent is quoted — a diff line that anchors
 * nowhere is neither tinted nor quoted. A whole-file surface answers the same question from
 * its own lines; only the diff has to walk hunks to do it.
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

/** Total added / removed lines across a file's hunks — the diff header's counters. */
export function countDiffLines(hunks: readonly DiffHunk[]): {
  additions: number
  deletions: number
} {
  let additions = 0
  let deletions = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') additions += 1
      else if (line.kind === 'del') deletions += 1
    }
  }
  return { additions, deletions }
}

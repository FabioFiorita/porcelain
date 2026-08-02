import type { DiffHunk, FeatureReading, FileStatus } from '@/lib/daemon/procedures/changes'

/**
 * A diff is rendered as one flat, pre-computed row array fed to a single virtualized `List` —
 * never a `List` inside a `List`, and never a nested map at render time. Every row carries its
 * own stable key so a refetch reuses cells instead of rebuilding the document.
 */
export type DiffRow =
  | { key: string; kind: 'layer'; label: string }
  | {
      key: string
      kind: 'file'
      path: string
      status?: FileStatus
      additions?: number
      deletions?: number
    }
  | { key: string; kind: 'hunk'; header: string }
  | { key: string; kind: 'line'; tone: 'context' | 'add' | 'del'; gutter: string; text: string }
  | { key: string; kind: 'notice'; text: string; path?: string }

/** Per file, on the SwiftUI list: beyond this the reader offers the file's own screen instead. */
const MAX_FILE_LINES = 300
/** Per file, on the native row canvas. A drawn row costs an offset and a `draw` call, not a
 *  cell, so the only remaining budget is the row JSON crossing the bridge. */
export const CANVAS_FILE_LINES = 3000
/** Whole document. The daemon builds up to ~200 files of hunks in one response; the phone
 *  renders a prefix of it and says so, rather than pushing 100k rows through the bridge. */
const MAX_ROWS = 6000

const GUTTER_WIDTH = 4

function gutterFor(line: { oldLine: number | null; newLine: number | null }): string {
  const number = line.newLine ?? line.oldLine
  return number === null ? '' : String(number).padStart(GUTTER_WIDTH, ' ')
}

function lineRows(hunks: readonly DiffHunk[], path: string, budget: number): DiffRow[] {
  const rows: DiffRow[] = []
  let rendered = 0
  let total = 0

  for (const [hunkIndex, hunk] of hunks.entries()) {
    total += hunk.lines.length
    if (rendered >= budget) continue
    rows.push({ header: hunk.header, key: `${path}:${hunkIndex}:h`, kind: 'hunk' })
    for (const [lineIndex, line] of hunk.lines.entries()) {
      if (rendered >= budget) break
      rows.push({
        gutter: gutterFor(line),
        key: `${path}:${hunkIndex}:${lineIndex}`,
        kind: 'line',
        text: line.text,
        tone: line.kind,
      })
      rendered += 1
    }
  }

  if (total > rendered) {
    rows.push({
      key: `${path}:more`,
      kind: 'notice',
      path,
      text: `${total - rendered} more lines — open the file`,
    })
  }
  return rows
}

/** One file's hunks, for the focused file screen. `binary` files have no rows to show. */
export function fileDiffRows(hunks: readonly DiffHunk[], path: string): DiffRow[] {
  if (hunks.length === 0) return [{ key: `${path}:empty`, kind: 'notice', text: NO_TEXT_DIFF }]
  return lineRows(hunks, path, MAX_ROWS)
}

const NO_TEXT_DIFF = 'Binary or unreadable — not shown'

/**
 * The whole change as one document, in the daemon's flow order. Layers and files are never
 * re-sorted here: that grouping is the product, not a client-side view option.
 */
export function readingRows(
  reading: FeatureReading,
  fileLineBudget: number = MAX_FILE_LINES,
): DiffRow[] {
  const rows: DiffRow[] = []

  for (const group of reading.groups) {
    if (rows.length >= MAX_ROWS) break
    rows.push({ key: `layer:${group.layer}`, kind: 'layer', label: group.layer })
    for (const file of group.files) {
      if (rows.length >= MAX_ROWS) break
      rows.push({
        additions: file.additions,
        deletions: file.deletions,
        key: `file:${file.path}`,
        kind: 'file',
        path: file.path,
        status: file.status,
      })
      const hunks = file.hunks ?? []
      if (hunks.length === 0) {
        rows.push({
          key: `${file.path}:empty`,
          kind: 'notice',
          path: file.path,
          text: NO_TEXT_DIFF,
        })
        continue
      }
      rows.push(...lineRows(hunks, file.path, fileLineBudget))
    }
  }

  if (rows.length >= MAX_ROWS) {
    rows.length = MAX_ROWS
    rows.push({
      key: 'document:truncated',
      kind: 'notice',
      text: 'Change too large to read inline — open files individually',
    })
  }
  return rows
}

/** Row ids hidden under a collapsed file header in the whole-change canvas. */
export function collapsedRowIds(
  rows: readonly DiffRow[],
  collapsedPaths: ReadonlySet<string>,
): string[] {
  const hidden: string[] = []
  let filePath: string | null = null

  for (const row of rows) {
    if (row.kind === 'layer') {
      filePath = null
      continue
    }
    if (row.kind === 'file') {
      filePath = row.path
      continue
    }

    if (filePath === null || !collapsedPaths.has(filePath)) continue
    if (row.kind === 'notice' && row.path === undefined) {
      filePath = null
      continue
    }
    hidden.push(row.key)
  }

  return hidden
}

/** Totals the list header and the large-change guard both quote. */
export function totalStats(
  groups: readonly { files: readonly { additions?: number; deletions?: number }[] }[],
): {
  files: number
  additions: number
  deletions: number
} {
  let files = 0
  let additions = 0
  let deletions = 0
  for (const group of groups) {
    for (const file of group.files) {
      files += 1
      additions += file.additions ?? 0
      deletions += file.deletions ?? 0
    }
  }
  return { additions, deletions, files }
}

/** Past this a `diffReading` is too heavy to fire without asking — payload, not render, is the
 *  cost, so the check happens before the request. */
export function isLargeChange(totals: {
  files: number
  additions: number
  deletions: number
}): boolean {
  return totals.files > 60 || totals.additions + totals.deletions > 4000
}

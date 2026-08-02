import type { DiffRow } from '@/features/changes/lib/diff-rows'
import { formatStats } from '@/features/changes/lib/format'
import { wordDiff } from '@/features/changes/lib/word-diff'
import type { FileStatus } from '@/lib/daemon/procedures/changes'
import type { RowCanvasRow } from '@/lib/row-canvas/types'

/**
 * The diff adapter: `DiffRow[]` — the same array the SwiftUI list renders — mapped onto the
 * canvas's feature-blind row model. Every diff concept becomes one of the role names
 * `canvas-theme.ts` colours (`layer`, `file`, `hunk`, `context`, `add`, `del`, `notice`), so
 * the native side stays reusable for the terminal grid.
 */

const STATUS_LETTERS: Record<FileStatus, string> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
  untracked: 'U',
}

function fileText(row: Extract<DiffRow, { kind: 'file' }>): string {
  const stats = formatStats(row.additions, row.deletions)
  return stats === '' ? row.path : `${row.path}  ${stats}`
}

/**
 * A deleted run followed by an added run of the same length is the one pairing that is
 * unambiguous — anything else is a rewrite, and guessing at it highlights the wrong words.
 */
function wordRanges(rows: readonly DiffRow[]): Map<string, { start: number; end: number }[]> {
  const ranges: Map<string, { start: number; end: number }[]> = new Map()

  for (let index = 0; index < rows.length; index += 1) {
    const deleted: Extract<DiffRow, { kind: 'line' }>[] = []
    while (index < rows.length) {
      const row = rows[index]
      if (row.kind !== 'line' || row.tone !== 'del') break
      deleted.push(row)
      index += 1
    }
    if (deleted.length === 0) continue

    const added: Extract<DiffRow, { kind: 'line' }>[] = []
    let cursor = index
    while (cursor < rows.length) {
      const row = rows[cursor]
      if (row.kind !== 'line' || row.tone !== 'add') break
      added.push(row)
      cursor += 1
    }
    if (added.length !== deleted.length) continue

    for (const [pair, before] of deleted.entries()) {
      const after = added[pair]
      const diff = wordDiff(before.text, after.text)
      if (diff.del.length > 0) ranges.set(before.key, diff.del)
      if (diff.add.length > 0) ranges.set(after.key, diff.add)
    }
    index = cursor - 1
  }

  return ranges
}

type WordRange = { start: number; end: number }
type RangeMap = ReadonlyMap<string, WordRange[]>

type DiffCanvasOptions = {
  collapsible?: boolean
  collapsedPaths?: ReadonlySet<string>
  ranges?: RangeMap
}

/** Roles carrying a heading rather than a code line need the extra height reserved up front. */
function canvasRow(row: DiffRow, ranges: RangeMap, options: DiffCanvasOptions): RowCanvasRow {
  switch (row.kind) {
    case 'layer':
      return { heightScale: 1.6, id: row.key, role: 'layer', text: row.label.toUpperCase() }
    case 'file': {
      const status = row.status === undefined ? '' : STATUS_LETTERS[row.status]
      const indicator = options.collapsedPaths?.has(row.path) === true ? '▸' : '▾'
      const gutter =
        options.collapsible === true ? `${status}${status === '' ? '' : ' '}${indicator}` : status
      return {
        gutter,
        heightScale: 1.9,
        id: row.key,
        role: 'file',
        sticky: true,
        text: fileText(row),
      }
    }
    case 'hunk':
      return { id: row.key, role: 'hunk', text: row.header }
    case 'line':
      return {
        gutter: row.gutter.trim(),
        id: row.key,
        ranges: ranges.get(row.key),
        role: row.tone,
        text: row.text,
      }
    case 'notice':
      return { heightScale: 1.5, id: row.key, role: 'notice', text: row.text }
  }
}

export function diffCanvasRows(
  rows: readonly DiffRow[],
  options: DiffCanvasOptions = {},
): RowCanvasRow[] {
  const ranges = options.ranges ?? wordRanges(rows)
  return rows.map((row) => canvasRow(row, ranges, options))
}

/** Cache the expensive word pairing separately from the cheap file-header presentation. */
export function diffCanvasRanges(rows: readonly DiffRow[]): RangeMap {
  return wordRanges(rows)
}

export type TokenizableLine = { text: string; path: string }

/**
 * The rows a tokenizer may colour, with the path whose language they are written in. Only code
 * lines qualify; the path is tracked from the file rows the document already carries, so the
 * single-file screen — which has none — supplies its own.
 */
export function tokenizableLines(
  rows: readonly DiffRow[],
  defaultPath = '',
): Map<string, TokenizableLine> {
  const lines: Map<string, TokenizableLine> = new Map()
  let path = defaultPath
  for (const row of rows) {
    if (row.kind === 'file') path = row.path
    if (row.kind === 'line') lines.set(row.key, { path, text: row.text })
  }
  return lines
}

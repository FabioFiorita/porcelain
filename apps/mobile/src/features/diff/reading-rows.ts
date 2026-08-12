import type { DiffReadingOutput } from '@porcelain/contracts/git'

import { type DiffMode, type DiffRow, toDiffRows } from './diff-rows'

type ReadingFile = DiffReadingOutput['groups'][number]['files'][number]

/**
 * One row of the continuous "read all" surface: layer captions, per-file headers, and the
 * diff rows of every file, flattened into a single stream.
 */
export type ReadingRow =
  | { kind: 'layer'; key: string; layer: string }
  | { kind: 'file'; key: string; file: ReadingFile }
  | { kind: 'diff'; key: string; path: string; row: DiffRow }
  | { kind: 'no-diff'; key: string; path: string }

/**
 * Flatten the whole change set into one list.
 *
 * Stacking every file's hunks into a single virtualized stream is what makes reading a change
 * set end to end feel like one document instead of N screens — and it is the only shape that
 * stays cheap when the set is large, because the list windows across file boundaries.
 */
export function toReadingRows(
  reading: DiffReadingOutput,
  mode: DiffMode,
  /** Files whose body is folded away; their header stays so the set reads as a table of contents. */
  collapsed?: ReadonlySet<string>,
): ReadingRow[] {
  const rows: ReadingRow[] = []
  for (const group of reading.groups) {
    rows.push({ key: `layer:${group.layer}`, kind: 'layer', layer: group.layer })
    for (const file of group.files) {
      rows.push({ file, key: `file:${file.path}`, kind: 'file' })
      if (collapsed?.has(file.path) === true) continue
      const hunks = file.hunks ?? []
      if (hunks.length === 0) {
        rows.push({ key: `nodiff:${file.path}`, kind: 'no-diff', path: file.path })
        continue
      }
      for (const row of toDiffRows(hunks, mode)) {
        rows.push({ key: `${file.path}:${row.key}`, kind: 'diff', path: file.path, row })
      }
    }
  }
  return rows
}

/** Files in the reading, in flow order — the bulk reviewed toggle's input for this surface. */
export function readingPaths(reading: DiffReadingOutput): string[] {
  return reading.groups.flatMap((group) => group.files.map((file) => file.path))
}

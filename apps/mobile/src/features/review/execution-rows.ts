import { type DiffMode, type DiffRow, toDiffRows } from '@/features/diff/diff-rows'
import type { SourceRow } from '@/features/files/source-rows'
import type { FeatureReading, ReadingFile } from '@/lib/daemon/procedures/review'

/**
 * One row of the Execution canvas.
 *
 * Execution is the Review's file half read as a single document: block captions, per-file
 * headers, and each file's *relevant lines* — hunks for a changed file, symbol slices for a
 * context or shipped one. Flattening to rows up front is what lets a virtualized list window
 * across file boundaries, the same trade `reading-rows` makes for the continuous read.
 */
export type ExecutionRow =
  | { kind: 'block'; key: string; blockId: string; title: string; fileCount: number }
  | { kind: 'file'; key: string; file: ReadingFile }
  | { kind: 'note'; key: string; path: string; note: string }
  | { kind: 'diff'; key: string; path: string; row: DiffRow }
  | { kind: 'source'; key: string; path: string; row: SourceRow }
  /** Lines elided between two slices — drawn, never silently skipped. */
  | { kind: 'gap'; key: string; path: string; lines: number }
  /** The slice hit the daemon's cap; more relevant lines exist than are shown. */
  | { kind: 'truncated'; key: string; path: string }
  | { kind: 'empty'; key: string; path: string; file: ReadingFile }

/** A jump target in the outline: a walkthrough section, or a "More files" group. */
export type ExecutionBlock = { id: string; title: string; fileCount: number }

/**
 * The blocks of the Execution outline, in reading order, with a file appearing under exactly
 * one of them.
 *
 * The dedup is the same one `reviewOutlineFiles` does, and it has to be: a file the agent both
 * anchored to a section and left in a group is one file, and counting it twice would make the
 * reviewed fraction — and so the lifecycle phase — disagree with the desktop for the same
 * repo. Doing it here as well keeps the rendered document honest for the same reason, and
 * keeps every row key unique, which a virtualized list requires.
 */
export function executionBlocks(reading: FeatureReading): {
  blocks: ExecutionBlock[]
  filesByBlock: Map<string, ReadingFile[]>
} {
  const seen = new Set<string>()
  const blocks: ExecutionBlock[] = []
  const filesByBlock = new Map<string, ReadingFile[]>()

  const claim = (id: string, title: string, candidates: readonly ReadingFile[]): void => {
    const files: ReadingFile[] = []
    for (const file of candidates) {
      if (seen.has(file.path)) continue
      seen.add(file.path)
      files.push(file)
    }
    if (files.length === 0) return
    blocks.push({ fileCount: files.length, id, title })
    filesByBlock.set(id, files)
  }

  reading.sections.forEach((section, index) => {
    claim(
      `section:${index}`,
      section.title.trim() === '' ? 'Walkthrough' : section.title,
      section.files,
    )
  })
  for (const group of reading.groups) {
    claim(`group:${group.layer}`, group.layer, group.files)
  }

  return { blocks, filesByBlock }
}

/**
 * Flatten the Review's files into one list.
 *
 * A changed file goes through `toDiffRows`, so a diff read here is the same diff read in
 * Changes. A context or shipped file has no diff at all — the daemon sends the symbol slices
 * it decided were worth reading — so its ranges are flattened into plain source rows with an
 * explicit gap row wherever lines were elided. Dropping the gap would present two distant
 * ranges as adjacent code, which is a lie about the file.
 */
export function toExecutionRows(
  reading: FeatureReading,
  mode: DiffMode,
  /** Files whose body is folded away; their header stays so the set reads as a contents list. */
  collapsed?: ReadonlySet<string>,
): ExecutionRow[] {
  const { blocks, filesByBlock } = executionBlocks(reading)
  const rows: ExecutionRow[] = []

  for (const block of blocks) {
    rows.push({
      blockId: block.id,
      fileCount: block.fileCount,
      key: `block:${block.id}`,
      kind: 'block',
      title: block.title,
    })
    for (const file of filesByBlock.get(block.id) ?? []) {
      rows.push({ file, key: `file:${file.path}`, kind: 'file' })
      if (collapsed?.has(file.path) === true) continue
      if (file.note !== undefined && file.note.trim() !== '') {
        rows.push({ key: `note:${file.path}`, kind: 'note', note: file.note, path: file.path })
      }
      pushBodyRows(rows, file, mode)
    }
  }

  return rows
}

function pushBodyRows(rows: ExecutionRow[], file: ReadingFile, mode: DiffMode): void {
  const { hunks, path, ranges } = file

  if (hunks !== undefined) {
    if (hunks.length === 0) {
      rows.push({ file, key: `empty:${path}`, kind: 'empty', path })
      return
    }
    for (const row of toDiffRows(hunks, mode)) {
      rows.push({ key: `${path}:${row.key}`, kind: 'diff', path, row })
    }
    return
  }

  if (ranges !== undefined) {
    if (ranges.length === 0) {
      rows.push({ file, key: `empty:${path}`, kind: 'empty', path })
      return
    }
    ranges.forEach((range, index) => {
      // `gapBefore` counts the lines elided immediately before this range — including the
      // head of the file before the first one, which is why this is not an `index > 0` test.
      if (range.gapBefore > 0) {
        rows.push({
          key: `${path}:gap:${index}`,
          kind: 'gap',
          lines: range.gapBefore,
          path,
        })
      }
      range.lines.forEach((text, offset) => {
        const line = range.startLine + offset
        rows.push({
          key: `${path}:src:${line}`,
          kind: 'source',
          path,
          row: { key: String(line), line, text },
        })
      })
    })
    if (file.truncated === true) {
      rows.push({ key: `truncated:${path}`, kind: 'truncated', path })
    }
    return
  }

  rows.push({ file, key: `empty:${path}`, kind: 'empty', path })
}

/** Where a block's caption sits in the flattened list — the outline's scroll target. */
export function blockRowIndex(rows: readonly ExecutionRow[], blockId: string): number {
  return rows.findIndex((row) => row.kind === 'block' && row.blockId === blockId)
}

/** Files in the Execution document, deduped and in reading order. */
export function executionPaths(reading: FeatureReading): string[] {
  const { blocks, filesByBlock } = executionBlocks(reading)
  return blocks.flatMap((block) => (filesByBlock.get(block.id) ?? []).map((file) => file.path))
}

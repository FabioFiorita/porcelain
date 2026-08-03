import type { RowCanvasRow } from '@/lib/row-canvas/types'
import type { AppearanceScheme } from '@/theme/colors'
import { ink } from '@/theme/colors'
import { disclosureSymbol, type FileSymbol, fileSymbol, folderSymbol } from '@/theme/file-icons'
import { INDENT_COLUMNS, SYMBOL_COLUMNS } from '@/theme/list-canvas'

/**
 * The path-list adapter: the one row model every surface that lists files builds, mapped onto the
 * canvas's feature-blind rows. Files, Changes and History differ in what they put in the trailing
 * columns and which glyph leads a row — never in how a row is drawn.
 */

/** A trailing column: an item count, `+12 −3`, "Pinned". Muted unless it names its own tint. */
export type EntrySpan = { text: string; tint?: string }

export type EntryItem =
  | {
      kind: 'section'
      key: string
      title: string
      trailing?: readonly EntrySpan[]
    }
  | {
      /** A tappable row that is not a path: an entry point like All changes, or a commit. */
      kind: 'item'
      key: string
      name: string
      symbol: FileSymbol
      trailing?: readonly EntrySpan[]
      label?: string
    }
  | {
      kind: 'dir' | 'file'
      key: string
      /** Absolute daemon path. Every callback speaks in these. */
      path: string
      name: string
      /** Tree level; 0 for a flat list. */
      depth: number
      expanded?: boolean
      /** Hidden or otherwise de-emphasised. */
      dimmed?: boolean
      /** Replaces the type glyph — Changes leads with git status instead. */
      symbol?: FileSymbol
      trailing?: readonly EntrySpan[]
      /** Overrides the spoken label; the drawn columns read badly otherwise. */
      label?: string
    }

/** Every row a caller can be handed back from a press. */
export type EntryTarget = Exclude<EntryItem, { kind: 'section' }>

export type EntryRowsOptions = {
  scheme: AppearanceScheme
  /**
   * Reserve the disclosure column. A tree sets it so folders can open and files still line up
   * under them; a flat list leaves it off and starts every row at its own glyph.
   */
  disclosure?: boolean
}

const SECTION_HEIGHT_SCALE = 0.85

export function entryCanvasRows(
  items: readonly EntryItem[],
  options: EntryRowsOptions,
): RowCanvasRow[] {
  return items.map((item) => canvasRow(item, options))
}

function canvasRow(item: EntryItem, options: EntryRowsOptions): RowCanvasRow {
  if (item.kind === 'section') {
    return {
      cells: [{ text: item.title.toUpperCase() }, ...spanCells(item.trailing, options.scheme)],
      heightScale: SECTION_HEIGHT_SCALE,
      id: item.key,
      indent: 1,
      label: spokenSection(item),
      role: 'section',
      sticky: true,
    }
  }

  if (item.kind === 'item') {
    return {
      cells: [{ text: item.name }, ...spanCells(item.trailing, options.scheme)],
      id: item.key,
      indent: 0,
      label:
        item.label ?? [item.name, ...(item.trailing ?? []).map((span) => span.text)].join(', '),
      role: 'entry',
      symbols: [item.symbol],
    }
  }

  const disclosure = options.disclosure === true
  const isDir = item.kind === 'dir'
  const symbols: FileSymbol[] = []
  if (disclosure && isDir) symbols.push(disclosureSymbol(item.expanded === true, options.scheme))
  symbols.push(item.symbol ?? entrySymbol(item, options.scheme))

  return {
    cells: [{ text: item.name }, ...spanCells(item.trailing, options.scheme)],
    id: item.key,
    // A file in a tree pays for the disclosure column it does not have, so its name lands on the
    // same character as the folder names around it.
    indent: item.depth * INDENT_COLUMNS + (disclosure && !isDir ? SYMBOL_COLUMNS : 0),
    label: item.label ?? spokenEntry(item),
    role: item.dimmed === true ? 'dim' : 'entry',
    symbols,
  }
}

function entrySymbol(
  item: Extract<EntryItem, { kind: 'dir' | 'file' }>,
  scheme: AppearanceScheme,
): FileSymbol {
  return item.kind === 'dir'
    ? folderSymbol(item.expanded === true, scheme)
    : fileSymbol(item.name, scheme)
}

/** Two spaces before each column: the canvas has no tab stops, and one space reads as a typo. */
function spanCells(
  spans: readonly EntrySpan[] | undefined,
  scheme: AppearanceScheme,
): { text: string; fg: string }[] {
  if (spans === undefined) return []
  const muted = ink('muted', scheme)
  return spans
    .filter((span) => span.text !== '')
    .map((span) => ({ fg: span.tint ?? muted, text: `  ${span.text}` }))
}

function spokenSection(item: Extract<EntryItem, { kind: 'section' }>): string {
  return [item.title, ...(item.trailing ?? []).map((span) => span.text)].join(', ')
}

function spokenEntry(item: Extract<EntryItem, { kind: 'dir' | 'file' }>): string {
  const state =
    item.kind === 'dir' ? (item.expanded === true ? 'expanded' : 'collapsed') : undefined
  return [item.name, item.kind === 'dir' ? 'folder' : 'file', state, ...trailingText(item)]
    .filter((part) => part !== undefined && part !== '')
    .join(', ')
}

function trailingText(item: Extract<EntryItem, { kind: 'dir' | 'file' }>): string[] {
  return (item.trailing ?? []).map((span) => span.text)
}

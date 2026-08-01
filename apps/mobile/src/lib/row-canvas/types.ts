/**
 * The row canvas contract. It is deliberately feature-blind: a row is text or cells, a role
 * name, an optional gutter and an optional set of character ranges. Diff tones, terminal
 * attributes and log levels are all just roles the JS adapter names and the theme colours.
 */

/** One styled span of a `cells` row — the shape a terminal grid adapter will emit. */
type RowCanvasCell = {
  text: string
  fg?: string
  bg?: string
  bold?: boolean
}

/** A character range within the row's text, painted with `role.highlight`. */
type RowCanvasRange = {
  start: number
  end: number
  role?: string
}

export type RowCanvasRow = {
  id: string
  text?: string
  cells?: RowCanvasCell[]
  gutter?: string
  /** Leading blank columns, in characters — cheaper than padding the text itself. */
  indent?: number
  role?: string
  /** Pins the row under the top edge while its section scrolls past. */
  sticky?: boolean
  /** Multiple of the theme's `rowHeight`. */
  heightScale?: number
  ranges?: RowCanvasRange[]
}

/** A syntax token, patched in per row after the rows themselves are on screen. */
export type RowCanvasToken = {
  text: string
  color?: string
  bold?: boolean
  italic?: boolean
}

export type RowCanvasTokensPatch = {
  /** Dropped natively when it no longer matches the view's `tokensResetKey`. */
  resetKey: string
  tokensByRowId: Record<string, RowCanvasToken[]>
}

type RowCanvasRole = {
  fg?: string
  bg?: string
  accent?: string
  highlight?: string
}

export type RowCanvasTheme = {
  background: string
  text: string
  mutedText: string
  border: string
  selection: string
  roles: Record<string, RowCanvasRole>
  rowHeight: number
  fontSize: number
  fontWeight?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold'
  gutterFontSize: number
  gutterWidth: number
  accentBarWidth: number
  contentPadding: number
  maxContentWidth: number
}

export type RowCanvasState = {
  collapsedRowIds?: string[]
  pinnedRowIds?: string[]
  selectedRowIds?: string[]
}

export type RowCanvasVisibleRange = {
  firstIndex: number
  lastIndex: number
  firstRowId: string
  lastRowId: string
  totalRows: number
}

export type RowCanvasRowEvent = {
  rowId: string
  index: number
  /** Character column under the finger, already corrected for indent and horizontal pan. */
  charIndex: number
  inGutter: boolean
}

export type RowCanvasHandle = {
  scrollToRow: (rowId: string, animated?: boolean) => Promise<void>
  scrollToTop: (animated?: boolean) => Promise<void>
}

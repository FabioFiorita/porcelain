import { paletteColor, rgbColor, type TerminalPalette } from './terminal-theme'

/**
 * Turning an xterm buffer row into the runs React Native paints.
 *
 * The desktop client hands its buffer to a WebGL/DOM renderer that draws per cell. React
 * Native has no such renderer, so the viewer paints `<Text>` spans instead — which means the
 * expensive thing is the SPAN COUNT, not the cell count. Adjacent cells that share every
 * attribute therefore collapse into one run, and a row of plain output becomes a single span.
 *
 * Structured against a minimal cell interface rather than xterm's own types so the mapping —
 * inverse, dim, 256-colour indices, wide glyphs — is unit-tested without booting a VT engine.
 */

/**
 * The slice of xterm's `IBufferCell` this painter reads, structurally compatible with it so a
 * real buffer line passes without a cast. The split return types are xterm's own: colour mode
 * is a predicate, while the attributes report a flag as a number.
 */
export type TerminalCell = {
  getChars: () => string
  getWidth: () => number
  isFgPalette: () => boolean
  isBgPalette: () => boolean
  isFgRGB: () => boolean
  isBgRGB: () => boolean
  getFgColor: () => number
  getBgColor: () => number
  isBold: () => number
  isDim: () => number
  isItalic: () => number
  isUnderline: () => number
  isInverse: () => number
  isInvisible: () => number
}

export type TerminalLine = {
  // xterm's own signature takes an optional cell to recycle; leaving it out here is what keeps
  // this type structurally compatible with `IBufferLine` (an optional parameter would have to
  // accept xterm's fuller cell, not ours).
  getCell: (index: number) => TerminalCell | undefined
  length: number
}

/** The slice of a live terminal the viewer paints from. */
export type TerminalSnapshot = {
  cols: number
  rows: number
  buffer: {
    active: {
      viewportY: number
      baseY: number
      cursorX: number
      cursorY: number
      getLine: (y: number) => TerminalLine | undefined
    }
  }
}

export type TerminalViewport = {
  /** Exactly `rows` entries — a terminal is a fixed grid, even where nothing was written. */
  rows: TerminalRun[][]
  /** Grid position, or null when the cursor is off-screen (scrolled back through history). */
  cursor: { column: number; row: number } | null
}

export type RunStyle = {
  color: string
  /** Omitted when the cell keeps the pane's own background — nothing to paint. */
  background?: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type TerminalRun = { text: string; style: RunStyle }

/** Dim is 70% ink. React Native reads 8-digit hex, so this stays a colour rather than opacity
 *  on the span — an opacity would fade the background fill with it. */
const DIM_ALPHA = 'b3'

function fgColor(cell: TerminalCell, palette: TerminalPalette): string {
  if (cell.isFgRGB()) return rgbColor(cell.getFgColor())
  if (cell.isFgPalette()) return paletteColor(cell.getFgColor(), palette)
  return palette.foreground
}

function bgColor(cell: TerminalCell, palette: TerminalPalette): string | undefined {
  if (cell.isBgRGB()) return rgbColor(cell.getBgColor())
  if (cell.isBgPalette()) return paletteColor(cell.getBgColor(), palette)
  return undefined
}

function styleOf(cell: TerminalCell, palette: TerminalPalette): RunStyle {
  const inverse = cell.isInverse() !== 0
  // Inverse swaps the two, and an inverted DEFAULT pair has to resolve to the real theme
  // colours first — otherwise "no background" would swap into "no foreground" and vanish.
  const ink = inverse ? (bgColor(cell, palette) ?? palette.background) : fgColor(cell, palette)
  const fill = inverse ? fgColor(cell, palette) : bgColor(cell, palette)
  return {
    background: fill,
    bold: cell.isBold() !== 0,
    // Invisible keeps the cell's width and background but paints no glyph; matching the ink to
    // the fill is how a text renderer says that.
    color: cell.isInvisible() !== 0 ? (fill ?? palette.background) : dim(ink, cell),
    italic: cell.isItalic() !== 0,
    underline: cell.isUnderline() !== 0,
  }
}

function dim(color: string, cell: TerminalCell): string {
  if (cell.isDim() === 0) return color
  return color.length === 7 ? `${color}${DIM_ALPHA}` : color
}

function sameStyle(a: RunStyle, b: RunStyle): boolean {
  return (
    a.color === b.color &&
    a.background === b.background &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline
  )
}

/**
 * One buffer row as painted runs.
 *
 * Trailing cells that carry nothing — no glyph and no background — are dropped: a terminal
 * row is `cols` wide whether or not anything was written to it, and painting 200 spaces per
 * row costs real layout time on a phone for pixels that are already the pane's background.
 */
export function rowRuns(
  line: TerminalLine | undefined,
  cols: number,
  palette: TerminalPalette,
): TerminalRun[] {
  if (line === undefined) return []
  const runs: TerminalRun[] = []
  const width = Math.min(cols, line.length)

  for (let index = 0; index < width; index++) {
    const cell = line.getCell(index)
    if (cell === undefined) continue
    // A wide glyph (CJK, some emoji) occupies two cells: the first carries the character, the
    // second reports width 0 and must not contribute a second copy of it.
    if (cell.getWidth() === 0) continue

    const chars = cell.getChars()
    const style = styleOf(cell, palette)
    const previous = runs[runs.length - 1]
    const text = chars === '' ? ' ' : chars
    if (previous !== undefined && sameStyle(previous.style, style)) previous.text += text
    else runs.push({ style, text })
  }

  // Two steps, because unstyled blanks merge INTO the last run rather than forming their own:
  // drop runs that are entirely empty, then trim what is left dangling off the final one.
  while (runs.length > 0) {
    const last = runs[runs.length - 1]
    if (last === undefined) break
    if (last.style.background !== undefined || last.text.trim() !== '') break
    runs.pop()
  }
  const tail = runs[runs.length - 1]
  if (tail !== undefined && tail.style.background === undefined) {
    tail.text = tail.text.replace(/\s+$/u, '')
  }
  return runs
}

/**
 * The visible grid and where the cursor sits in it.
 *
 * `viewportY` is the buffer row currently at the top of the screen, so scrolled-back history
 * and live output are the same read — the emulator has already decided what is visible. The
 * cursor is placed against that same origin and is simply absent when you have scrolled away
 * from it.
 */
export function readViewport(
  term: TerminalSnapshot | undefined,
  palette: TerminalPalette,
): TerminalViewport {
  if (term === undefined) return { cursor: null, rows: [] }
  const { active } = term.buffer
  const rows: TerminalRun[][] = []
  for (let row = 0; row < term.rows; row++) {
    rows.push(rowRuns(active.getLine(active.viewportY + row), term.cols, palette))
  }
  const cursorRow = active.baseY + active.cursorY - active.viewportY
  const onScreen = cursorRow >= 0 && cursorRow < term.rows
  return {
    cursor: onScreen ? { column: active.cursorX, row: cursorRow } : null,
    rows,
  }
}

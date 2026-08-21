/**
 * The pane's geometry — the numbers that turn a measured pane into a grid, and the same
 * numbers that place the cursor on it.
 *
 * They live in their own module for one reason: `onLayout` reports React Native's BORDER box,
 * so the height it gives back INCLUDES the pane's own padding. Dividing that straight by the
 * line height asks the PTY for one more row than the pane can paint. That row is not
 * theoretical — a full-screen TUI (Claude Code, Codex, anything on Ink or blessed) anchors its
 * input box to the last row of the grid it was told about, via DECSTBM + CUP. The row is
 * written, real, and clipped away by the pane's `overflow-hidden`: the line you are typing on
 * is invisible.
 *
 * So the padding is subtracted here, once, and the cursor is placed with the same constants.
 * Two copies of "8" and "4" is exactly how the two drifted apart in the first place.
 */

import type { TerminalTextSize } from '@/features/settings/preferences-store'

/**
 * Point sizes behind the user's terminal text size preference.
 *
 * The ladder is anchored on COLUMNS, because that is what a terminal is spent on: at 9pt a
 * 393dp phone paints 71 columns, which is the density a good SSH client gives you on the same
 * screen and the one this app was measured against. 12 gives 54 and 15 gives 43 — the sizes
 * this ladder used to call small and medium, kept a step up so nobody's terminal changed size
 * without asking.
 *
 * Phones start at 'small' and tablets at 'large' (`preferences-store.ts`), which is 15pt on
 * both counts — the size a tablet already rendered before the ladder gained a denser bottom.
 */
const TERMINAL_FONT_SIZES: Record<TerminalTextSize, number> = {
  large: 15,
  medium: 12,
  small: 9,
}

export function terminalFontSize(size: TerminalTextSize): number {
  return TERMINAL_FONT_SIZES[size]
}

/** 1.0 would be truest to the grid, but React Native clips descenders below ~1.25. */
export function terminalLineHeight(size: TerminalTextSize): number {
  return Math.round(terminalFontSize(size) * 1.35)
}

/**
 * The pane's `px-2`, in pixels — subtracted from the measured width before it becomes cols.
 *
 * A terminal-specific number, tighter than `SURFACE_GUTTER`: a dense monospace grid reads
 * differently from the app's prose and list surfaces, and the full-screen session view has no
 * sibling chrome either side of it to align against. Kept just wide enough that output stays
 * off the bezel and the rounded corners.
 */
export const TERMINAL_PANE_PADDING_X = 8

/** The pane's `py-1`, in pixels — subtracted from the measured height before it becomes rows. */
export const TERMINAL_PANE_PADDING_Y = 4

/**
 * A grid narrower or shorter than this is a pane mid-layout, not a terminal. Clamping rather
 * than skipping keeps the PTY at a sane size while a split animates.
 */
const MIN_COLS = 2
const MIN_ROWS = 2

export type TerminalGrid = { cols: number; rows: number }

/**
 * The grid a measured pane can actually paint.
 *
 * `pane` is the border box `onLayout` reports, so the padding comes off first. Null when the
 * pane has not been measured yet (or is smaller than its own padding) — the caller has nothing
 * to fit and must not guess.
 */
export function terminalGrid(
  pane: { height: number; width: number },
  charWidth: number,
  lineHeight: number,
): TerminalGrid | null {
  if (!(charWidth > 0)) return null
  const contentWidth = pane.width - TERMINAL_PANE_PADDING_X * 2
  const contentHeight = pane.height - TERMINAL_PANE_PADDING_Y * 2
  if (contentWidth <= 0 || contentHeight <= 0) return null
  return {
    cols: Math.max(MIN_COLS, Math.floor(contentWidth / charWidth)),
    rows: Math.max(MIN_ROWS, Math.floor(contentHeight / lineHeight)),
  }
}

/**
 * The top of grid row `row`, in the pane's own coordinates.
 *
 * React Native positions an absolutely-placed child against the parent's BORDER box, so the
 * pane's padding has to be added back — the same padding `terminalGrid` took off.
 */
export function terminalRowTop(row: number, lineHeight: number): number {
  return TERMINAL_PANE_PADDING_Y + row * lineHeight
}

/** The left edge of grid column `column`, in the pane's own coordinates. */
export function terminalColumnLeft(column: number, charWidth: number): number {
  return TERMINAL_PANE_PADDING_X + column * charWidth
}

/**
 * How much of the measured pane is covered by chrome the grid must not be fitted into.
 *
 * Android resizes the pane when the keyboard appears; iOS overlays it, so only iOS subtracts the
 * keyboard inset here — applying it on both platforms shrinks Android twice.
 *
 * The floating tab bar sits over the bottom of the same pane, but the keyboard covers the tab
 * bar, so exactly one of the two is ever between the last row and the reader. Reserving both
 * would spend a couple of rows on space nothing occupies, and on a phone those rows are the
 * prompt — hence the max of two mutually exclusive claims rather than their sum.
 */
export function terminalCoveredInset(chrome: {
  bottomInset: number
  keyboardInset: number
  keyboardOverlays: boolean
}): number {
  return Math.max(
    chrome.keyboardOverlays ? chrome.keyboardInset : 0,
    chrome.keyboardInset > 0 ? 0 : chrome.bottomInset,
  )
}

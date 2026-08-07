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
 * Point sizes behind the user's terminal text size preference. 'small' is the original fixed
 * size this terminal shipped with — dense, but too small to read prose-heavy CLI output on a
 * phone, which is why 'medium' is the default (see `DEFAULTS` in `preferences-store.ts`).
 */
const TERMINAL_FONT_SIZES: Record<TerminalTextSize, number> = {
  large: 18,
  medium: 15,
  small: 12,
}

export function terminalFontSize(size: TerminalTextSize): number {
  return TERMINAL_FONT_SIZES[size]
}

/** 1.0 would be truest to the grid, but React Native clips descenders below ~1.25. */
export function terminalLineHeight(size: TerminalTextSize): number {
  return Math.round(terminalFontSize(size) * 1.35)
}

/**
 * The pane's `px-4`, in pixels — subtracted from the measured width before it becomes cols.
 *
 * The same 16pt gutter every other surface uses (`SURFACE_GUTTER`), not a terminal-specific
 * number. It costs about two columns at this font size, which is the right trade: nothing a
 * shell prints becomes readable at 52 columns that was not readable at 50, and output running
 * into the bezel is the thing that made this pane look unfinished next to the rest of the app.
 */
export const TERMINAL_PANE_PADDING_X = 16

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

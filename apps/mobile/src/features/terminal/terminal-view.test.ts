import { Terminal } from '@xterm/headless'
import { describe, expect, it } from 'vitest'

import { readViewport } from './terminal-cells'
import {
  TERMINAL_PANE_PADDING_X,
  TERMINAL_PANE_PADDING_Y,
  terminalColumnLeft,
  terminalCoveredInset,
  terminalGrid,
  terminalLineHeight,
  terminalRowTop,
} from './terminal-metrics'
import { TERMINAL_PALETTES } from './terminal-theme'

/**
 * The pane's sizing law, against the real VT engine.
 *
 * The view itself needs a native runtime, but the arithmetic that broke does not: `onLayout`
 * reports React Native's BORDER box, so a fit that divides it straight by the line height asks
 * the PTY for one more row than the pane can paint. That is not a rounding complaint — a
 * full-screen TUI parks its input box on the LAST row of the grid it was told about, so the
 * line the human is typing on is written into a row that sits outside the pane's clip. It
 * shipped invisible on an iPad and nothing here caught it, which is why these exist.
 */

const palette = TERMINAL_PALETTES.dark
/** One representative size — the grid math is identical at every size, this just fixes one. */
const LINE_HEIGHT = terminalLineHeight('medium')
/** A pane height chosen so the padding is the difference between 19 rows and 20. */
const PANE = { height: LINE_HEIGHT * 20, width: 400 }
const CHAR_WIDTH = 7

/** xterm parses asynchronously; the callback is when the buffer actually reflects the write. */
function write(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => {
    term.write(data, resolve)
  })
}

function bottomOf(row: number): number {
  return terminalRowTop(row, LINE_HEIGHT) + LINE_HEIGHT
}

function rightOf(column: number): number {
  return terminalColumnLeft(column, CHAR_WIDTH) + CHAR_WIDTH
}

describe('the grid a measured pane can paint', () => {
  it('takes the pane padding off both axes before dividing', () => {
    const grid = terminalGrid(PANE, CHAR_WIDTH, LINE_HEIGHT)
    expect(grid).toEqual({
      cols: Math.floor((PANE.width - TERMINAL_PANE_PADDING_X * 2) / CHAR_WIDTH),
      rows: Math.floor((PANE.height - TERMINAL_PANE_PADDING_Y * 2) / LINE_HEIGHT),
    })
  })

  it('asks for fewer rows than the border box would, which is the whole bug', () => {
    const grid = terminalGrid(PANE, CHAR_WIDTH, LINE_HEIGHT)
    // What the view used to compute: the padded height, divided.
    const borderBoxRows = Math.floor(PANE.height / LINE_HEIGHT)
    expect(grid?.rows).toBe(borderBoxRows - 1)
    // And that extra row is genuinely off the bottom of the pane.
    expect(bottomOf(borderBoxRows - 1)).toBeGreaterThan(PANE.height)
  })

  it('leaves every row and column it asked for inside the pane', () => {
    const grid = terminalGrid(PANE, CHAR_WIDTH, LINE_HEIGHT)
    expect(grid).not.toBeNull()
    if (grid === null) return
    expect(bottomOf(grid.rows - 1)).toBeLessThanOrEqual(PANE.height - TERMINAL_PANE_PADDING_Y)
    expect(rightOf(grid.cols - 1)).toBeLessThanOrEqual(PANE.width - TERMINAL_PANE_PADDING_X)
  })

  it('has nothing to fit before the pane or the ruler has measured', () => {
    expect(terminalGrid(PANE, 0, LINE_HEIGHT)).toBeNull()
    expect(terminalGrid({ height: 0, width: 0 }, CHAR_WIDTH, LINE_HEIGHT)).toBeNull()
    // A pane smaller than its own padding is mid-layout, not a two-row terminal.
    expect(terminalGrid({ height: 4, width: 8 }, CHAR_WIDTH, LINE_HEIGHT)).toBeNull()
  })

  it('keeps a two-row floor while a pane is still animating open', () => {
    // Room for exactly one column and less than one line — the clamp is what answers here,
    // not the division. Sized off the padding constants so tightening the gutter (the pane
    // shares the app's 16pt one) does not turn a floor test into an arithmetic test.
    const grid = terminalGrid(
      {
        height: TERMINAL_PANE_PADDING_Y * 2 + 1,
        width: TERMINAL_PANE_PADDING_X * 2 + CHAR_WIDTH,
      },
      CHAR_WIDTH,
      LINE_HEIGHT,
    )
    expect(grid).toEqual({ cols: 2, rows: 2 })
  })
})

describe("a TUI's input line on the grid the pane fitted", () => {
  it('lands on a row the pane can actually paint', async () => {
    const grid = terminalGrid(PANE, CHAR_WIDTH, LINE_HEIGHT)
    expect(grid).not.toBeNull()
    if (grid === null) return

    const term = new Terminal({
      allowProposedApi: true,
      cols: grid.cols,
      rows: grid.rows,
      scrollback: 100,
    })
    // What an agent CLI does on startup: claim a scroll region, then park its prompt on the
    // last row of the grid it was told about (DECSTBM + CUP).
    await write(term, `\x1b[1;${grid.rows}r\x1b[${grid.rows};1H> ready`)

    const viewport = readViewport(term, palette)
    const lastRow = viewport.rows[grid.rows - 1] ?? []
    expect(lastRow.map((run) => run.text).join('')).toBe('> ready')
    expect(viewport.cursor).toEqual({ column: 7, row: grid.rows - 1 })

    // The row the prompt is on, and the cursor blinking in it, are both inside the pane.
    expect(bottomOf(grid.rows - 1)).toBeLessThanOrEqual(PANE.height)
    expect(bottomOf(viewport.cursor?.row ?? 0)).toBeLessThanOrEqual(PANE.height)
  })

  it('would have been written below the clip on the old, unpadded grid', async () => {
    const borderBoxRows = Math.floor(PANE.height / LINE_HEIGHT)
    const term = new Terminal({
      allowProposedApi: true,
      cols: 40,
      rows: borderBoxRows,
      scrollback: 100,
    })
    await write(term, `\x1b[${borderBoxRows};1H> ready`)

    const viewport = readViewport(term, palette)
    // The prompt is really there — the PTY and the emulator agree about it. It is the PANE
    // that cannot show it, which is exactly why this failed silently.
    expect((viewport.rows[borderBoxRows - 1] ?? []).map((run) => run.text).join('')).toBe('> ready')
    expect(bottomOf(borderBoxRows - 1)).toBeGreaterThan(PANE.height)
  })
})

describe('the chrome covering the bottom of the pane', () => {
  const BOTTOM = 60
  const KEYBOARD = 300

  it('reserves the tab bar while no keyboard is up', () => {
    for (const keyboardOverlays of [true, false]) {
      expect(
        terminalCoveredInset({ bottomInset: BOTTOM, keyboardInset: 0, keyboardOverlays }),
      ).toBe(BOTTOM)
    }
  })

  it('reserves the keyboard instead of the tab bar where the keyboard overlays the app', () => {
    // iOS: the pane keeps its full height, so the rows the keyboard hides come off here — and
    // the tab bar is behind that keyboard, so it is not reserved a second time.
    expect(
      terminalCoveredInset({
        bottomInset: BOTTOM,
        keyboardInset: KEYBOARD,
        keyboardOverlays: true,
      }),
    ).toBe(KEYBOARD)
  })

  it('reserves nothing where the platform already resized the pane', () => {
    // Android: `onLayout` has already reported the shorter pane. Subtracting the inset again
    // would shrink it twice and cost the prompt its rows.
    expect(
      terminalCoveredInset({
        bottomInset: BOTTOM,
        keyboardInset: KEYBOARD,
        keyboardOverlays: false,
      }),
    ).toBe(0)
  })
})

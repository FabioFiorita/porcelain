import { describe, expect, it } from 'vitest'

import {
  readViewport,
  rowRuns,
  type TerminalCell,
  type TerminalLine,
  type TerminalSnapshot,
} from './terminal-cells'
import { TERMINAL_PALETTES } from './terminal-theme'

const palette = TERMINAL_PALETTES.dark

type CellSpec = {
  chars?: string
  width?: number
  fg?: { palette?: number; rgb?: number }
  bg?: { palette?: number; rgb?: number }
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
  invisible?: boolean
}

function cell(spec: CellSpec = {}): TerminalCell {
  return {
    getBgColor: () => spec.bg?.palette ?? spec.bg?.rgb ?? 0,
    getChars: () => spec.chars ?? ' ',
    getFgColor: () => spec.fg?.palette ?? spec.fg?.rgb ?? 0,
    getWidth: () => spec.width ?? 1,
    isBgPalette: () => spec.bg?.palette !== undefined,
    isBgRGB: () => spec.bg?.rgb !== undefined,
    isBold: () => (spec.bold === true ? 1 : 0),
    isDim: () => (spec.dim === true ? 1 : 0),
    isFgPalette: () => spec.fg?.palette !== undefined,
    isFgRGB: () => spec.fg?.rgb !== undefined,
    isInverse: () => (spec.inverse === true ? 1 : 0),
    isInvisible: () => (spec.invisible === true ? 1 : 0),
    isItalic: () => (spec.italic === true ? 1 : 0),
    isUnderline: () => (spec.underline === true ? 1 : 0),
  }
}

function line(cells: TerminalCell[]): TerminalLine {
  return { getCell: (index: number) => cells[index], length: cells.length }
}

function textOf(cells: CellSpec[]): string {
  return rowRuns(line(cells.map(cell)), cells.length, palette)
    .map((run) => run.text)
    .join('')
}

describe('rowRuns', () => {
  it('collapses adjacent cells that share a style into one span', () => {
    const runs = rowRuns(line([cell({ chars: 'o' }), cell({ chars: 'k' })]), 2, palette)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.text).toBe('ok')
  })

  it('splits a run where any attribute changes', () => {
    const runs = rowRuns(
      line([cell({ chars: 'a' }), cell({ bold: true, chars: 'b' }), cell({ chars: 'c' })]),
      3,
      palette,
    )
    expect(runs.map((run) => run.text)).toEqual(['a', 'b', 'c'])
    expect(runs[1]?.style.bold).toBe(true)
  })

  it('drops trailing blanks that carry no background', () => {
    expect(textOf([{ chars: 'h' }, { chars: 'i' }, {}, {}])).toBe('hi')
  })

  it('keeps trailing blanks that DO carry a background — a filled bar is content', () => {
    expect(textOf([{ chars: 'h' }, { bg: { palette: 4 } }, { bg: { palette: 4 } }])).toBe('h  ')
  })

  it('skips the zero-width half of a wide glyph so it is not duplicated', () => {
    expect(textOf([{ chars: '你', width: 2 }, { chars: '', width: 0 }, { chars: 'x' }])).toBe('你x')
  })

  it('resolves palette, cube and truecolor foregrounds', () => {
    const runs = rowRuns(
      line([
        cell({ chars: 'a', fg: { palette: 1 } }),
        cell({ chars: 'b', fg: { palette: 196 } }),
        cell({ chars: 'c', fg: { rgb: 0x00ff7f } }),
      ]),
      3,
      palette,
    )
    expect(runs[0]?.style.color).toBe(palette.ansi[1])
    expect(runs[1]?.style.color).toBe('#ff0000')
    expect(runs[2]?.style.color).toBe('#00ff7f')
  })

  it('inverse swaps ink and fill, resolving defaults to real theme colours', () => {
    const runs = rowRuns(line([cell({ chars: 'a', inverse: true })]), 1, palette)
    expect(runs[0]?.style.color).toBe(palette.background)
    expect(runs[0]?.style.background).toBe(palette.foreground)
  })

  it('dim fades the ink without touching the fill', () => {
    const runs = rowRuns(line([cell({ chars: 'a', dim: true, fg: { palette: 2 } })]), 1, palette)
    expect(runs[0]?.style.color).toBe(`${palette.ansi[2]}b3`)
  })

  it('invisible paints the glyph in the fill colour, keeping its width', () => {
    const runs = rowRuns(
      line([cell({ bg: { palette: 4 }, chars: 'secret', invisible: true })]),
      1,
      palette,
    )
    expect(runs[0]?.style.color).toBe(runs[0]?.style.background)
    expect(runs[0]?.text).toBe('secret')
  })

  it('never reads past the terminal width', () => {
    expect(textOf([{ chars: 'a' }, { chars: 'b' }])).toBe('ab')
    expect(
      rowRuns(line([cell({ chars: 'a' }), cell({ chars: 'b' })]), 1, palette)
        .map((run) => run.text)
        .join(''),
    ).toBe('a')
  })

  it('is empty for a line the buffer does not have', () => {
    expect(rowRuns(undefined, 80, palette)).toEqual([])
  })
})

function snapshot(options: {
  rows: number
  viewportY: number
  baseY: number
  cursorX: number
  cursorY: number
}): TerminalSnapshot {
  return {
    buffer: {
      active: {
        baseY: options.baseY,
        cursorX: options.cursorX,
        cursorY: options.cursorY,
        getLine: (y: number) => line([cell({ chars: String(y) })]),
        viewportY: options.viewportY,
      },
    },
    cols: 1,
    rows: options.rows,
  }
}

describe('readViewport', () => {
  it('reads exactly `rows` lines starting at the viewport origin', () => {
    const view = readViewport(
      snapshot({ baseY: 0, cursorX: 0, cursorY: 0, rows: 3, viewportY: 10 }),
      palette,
    )
    expect(view.rows).toHaveLength(3)
    expect(view.rows.map((runs) => runs[0]?.text)).toEqual(['10', '11', '12'])
  })

  it('places the cursor relative to the viewport, not the buffer', () => {
    const view = readViewport(
      snapshot({ baseY: 100, cursorX: 4, cursorY: 2, rows: 24, viewportY: 100 }),
      palette,
    )
    expect(view.cursor).toEqual({ column: 4, row: 2 })
  })

  it('hides the cursor once you scroll away from it', () => {
    const view = readViewport(
      snapshot({ baseY: 100, cursorX: 0, cursorY: 0, rows: 24, viewportY: 10 }),
      palette,
    )
    expect(view.cursor).toBeNull()
  })

  it('is empty before the emulator exists', () => {
    expect(readViewport(undefined, palette)).toEqual({ cursor: null, rows: [] })
  })
})

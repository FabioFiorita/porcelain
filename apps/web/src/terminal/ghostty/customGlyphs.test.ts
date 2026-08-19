import { describe, expect, it } from 'vitest'

import { drawGhosttyCustomGlyph, isGhosttyCustomGlyph } from './customGlyphs'

interface Recorder {
  readonly context: CanvasRenderingContext2D
  readonly rects: number[][]
  readonly strokes: number[]
  alpha: number
}

function recorder(scale = 1): Recorder {
  const rects: number[][] = []
  const strokes: number[] = []
  const state = { alpha: 1, lineWidth: 0 }
  const context = {
    getTransform: () => ({ a: scale, d: scale }) as DOMMatrix,
    fillRect: (...args: number[]) => rects.push(args),
    beginPath: () => {},
    moveTo: () => {},
    quadraticCurveTo: () => {},
    stroke: () => strokes.push(state.lineWidth),
    save: () => {},
    restore: () => {},
    set fillStyle(_value: string) {},
    get fillStyle() {
      return '#fff'
    },
    set strokeStyle(_value: string) {},
    set lineCap(_value: string) {},
    set lineWidth(value: number) {
      state.lineWidth = value
    },
    set globalAlpha(value: number) {
      state.alpha = value
    },
  } as unknown as CanvasRenderingContext2D
  return {
    context,
    rects,
    strokes,
    get alpha() {
      return state.alpha
    },
    set alpha(_value: number) {},
  }
}

/** A 10 × 16 cell at the origin of row 0, matching the renderer's cell rect. */
const CELL = { left: 0, right: 10, top: 0, bottom: 16 }

describe('isGhosttyCustomGlyph', () => {
  it('claims blocks and solid box drawing but leaves ordinary text to the font', () => {
    expect(isGhosttyCustomGlyph('█')).toBe(true)
    expect(isGhosttyCustomGlyph('▀')).toBe(true)
    expect(isGhosttyCustomGlyph('╭')).toBe(true)
    expect(isGhosttyCustomGlyph('║')).toBe(true)
    expect(isGhosttyCustomGlyph('a')).toBe(false)
    expect(isGhosttyCustomGlyph('')).toBe(false)
    // Dashed and diagonal forms stay with the font: they do not need to tile.
    expect(isGhosttyCustomGlyph('┄')).toBe(false)
    expect(isGhosttyCustomGlyph('╱')).toBe(false)
  })
})

describe('drawGhosttyCustomGlyph', () => {
  it('fills the whole cell for a full block, so stacked blocks leave no seam', () => {
    const { context, rects } = recorder()
    expect(drawGhosttyCustomGlyph(context, '█', CELL, '#fff')).toBe(true)
    expect(rects).toEqual([[0, 0, 10, 16]])
  })

  it('splits upper and lower halves on one shared edge', () => {
    const upper = recorder()
    const lower = recorder()
    drawGhosttyCustomGlyph(upper.context, '▀', CELL, '#fff')
    drawGhosttyCustomGlyph(lower.context, '▄', CELL, '#fff')
    const [upperLeft, upperTop, upperWidth, upperHeight] = upper.rects[0] ?? []
    const [lowerLeft, lowerTop, lowerWidth, lowerHeight] = lower.rects[0] ?? []
    expect([upperLeft, upperTop, upperWidth, upperHeight]).toEqual([0, 0, 10, 8])
    expect([lowerLeft, lowerTop, lowerWidth, lowerHeight]).toEqual([0, 8, 10, 8])
    // The two halves meet exactly: no sliver of background between them.
    expect((upperTop ?? 0) + (upperHeight ?? 0)).toBe(lowerTop)
  })

  it('draws eighths as fractions of the cell, snapped to device pixels', () => {
    const { context, rects } = recorder()
    drawGhosttyCustomGlyph(context, '▁', CELL, '#fff')
    drawGhosttyCustomGlyph(context, '▎', CELL, '#fff')
    expect(rects).toEqual([
      [0, 14, 10, 2],
      [0, 0, 3, 16],
    ])
  })

  it('snaps a fractional cell edge so neighbouring cells still share it', () => {
    // Two adjacent cells on a 7.2px advance, on a 2x display.
    const left = recorder(2)
    const right = recorder(2)
    drawGhosttyCustomGlyph(left.context, '█', { left: 4, right: 11.2, top: 0, bottom: 16 }, '#fff')
    drawGhosttyCustomGlyph(
      right.context,
      '█',
      { left: 11.2, right: 18.4, top: 0, bottom: 16 },
      '#fff',
    )
    const [leftX = 0, , leftWidth = 0] = left.rects[0] ?? []
    const [rightX = 0] = right.rects[0] ?? []
    expect(leftX + leftWidth).toBe(rightX)
    expect(rightX * 2).toBe(Math.round(rightX * 2))
  })

  it('tints the cell for shades instead of painting a dotted glyph', () => {
    const shade = recorder()
    drawGhosttyCustomGlyph(shade.context, '▒', CELL, '#fff')
    expect(shade.rects).toEqual([[0, 0, 10, 16]])
    expect(shade.alpha).toBe(0.5)
  })

  it('runs a vertical line the full height of the cell so rows connect', () => {
    const { context, rects } = recorder()
    drawGhosttyCustomGlyph(context, '│', CELL, '#fff')
    expect(rects).toHaveLength(1)
    const [, top, , height] = rects[0] ?? []
    expect(top).toBe(0)
    expect(height).toBe(16)
  })

  it('runs a horizontal line the full width of the cell so columns connect', () => {
    const { context, rects } = recorder()
    drawGhosttyCustomGlyph(context, '─', CELL, '#fff')
    expect(rects).toHaveLength(1)
    const [left, , width] = rects[0] ?? []
    expect(left).toBe(0)
    expect(width).toBe(10)
  })

  it('draws a heavy line thicker than a light one', () => {
    const light = recorder()
    const heavy = recorder()
    drawGhosttyCustomGlyph(light.context, '─', CELL, '#fff')
    drawGhosttyCustomGlyph(heavy.context, '━', CELL, '#fff')
    expect((heavy.rects[0] ?? [])[3]).toBeGreaterThan((light.rects[0] ?? [])[3] ?? 0)
  })

  it('reaches both edges from a corner, so a border joins its neighbours', () => {
    const { context, rects } = recorder()
    // ┌ leaves the cell downwards and to the right only.
    drawGhosttyCustomGlyph(context, '┌', CELL, '#fff')
    const vertical = rects.find(([, , width]) => (width ?? 0) < 10)
    const horizontal = rects.find(([, , width]) => width === undefined || width >= 5)
    expect(vertical?.[1] ?? 0).toBeGreaterThan(0)
    expect((vertical?.[1] ?? 0) + (vertical?.[3] ?? 0)).toBe(16)
    expect((horizontal?.[0] ?? 0) + (horizontal?.[2] ?? 0)).toBe(10)
  })

  it('draws two parallel rails for a double line', () => {
    const { context, rects } = recorder()
    drawGhosttyCustomGlyph(context, '═', CELL, '#fff')
    expect(rects).toHaveLength(2)
    for (const [left, , width] of rects) {
      expect(left).toBe(0)
      expect(width).toBe(10)
    }
    expect(rects[0]?.[1]).not.toBe(rects[1]?.[1])
  })

  it('strokes an arc for a rounded corner', () => {
    const { context, rects, strokes } = recorder()
    expect(drawGhosttyCustomGlyph(context, '╭', CELL, '#fff')).toBe(true)
    expect(rects).toHaveLength(0)
    expect(strokes).toHaveLength(1)
  })

  it('refuses characters the font should draw', () => {
    const { context, rects } = recorder()
    expect(drawGhosttyCustomGlyph(context, 'M', CELL, '#fff')).toBe(false)
    expect(rects).toHaveLength(0)
  })
})

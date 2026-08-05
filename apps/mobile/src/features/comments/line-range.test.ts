import { describe, expect, it } from 'vitest'

import {
  describeRange,
  isLineInRange,
  type LineSelection,
  rangeForPath,
  rangeOf,
} from './line-range'

const selection = (anchor: number, focus: number, path = 'src/a.ts'): LineSelection => ({
  anchor,
  focus,
  path,
})

describe('rangeOf', () => {
  it('orders a forward selection', () => {
    expect(rangeOf(selection(2, 5))).toEqual({ endLine: 5, startLine: 2 })
  })

  it('orders a selection extended backwards past its anchor', () => {
    expect(rangeOf(selection(5, 2))).toEqual({ endLine: 5, startLine: 2 })
  })

  it('treats a single anchored line as a one-line range', () => {
    expect(rangeOf(selection(7, 7))).toEqual({ endLine: 7, startLine: 7 })
  })
})

describe('rangeForPath', () => {
  it('returns the range for the file the selection belongs to', () => {
    expect(rangeForPath(selection(1, 3), 'src/a.ts')).toEqual({ endLine: 3, startLine: 1 })
  })

  it('returns null for any other file, so a stacked read tints only one', () => {
    expect(rangeForPath(selection(1, 3), 'src/b.ts')).toBeNull()
  })

  it('returns null when nothing is selected', () => {
    expect(rangeForPath(null, 'src/a.ts')).toBeNull()
  })
})

describe('isLineInRange', () => {
  const range = { endLine: 4, startLine: 2 }

  it('includes both bounds', () => {
    expect(isLineInRange(range, 2)).toBe(true)
    expect(isLineInRange(range, 4)).toBe(true)
  })

  it('excludes lines outside it', () => {
    expect(isLineInRange(range, 1)).toBe(false)
    expect(isLineInRange(range, 5)).toBe(false)
  })

  it('is false for a line that anchors nowhere', () => {
    expect(isLineInRange(range, undefined)).toBe(false)
  })

  it('is false when nothing is selected', () => {
    expect(isLineInRange(null, 3)).toBe(false)
  })
})

describe('describeRange', () => {
  it('names a single line', () => {
    expect(describeRange({ endLine: 12, startLine: 12 })).toBe('Line 12')
  })

  it('names a span', () => {
    expect(describeRange({ endLine: 18, startLine: 12 })).toBe('Lines 12–18')
  })
})

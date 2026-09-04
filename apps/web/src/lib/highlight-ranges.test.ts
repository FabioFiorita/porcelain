import { describe, expect, it } from 'vitest'
import { lineInHighlightRanges } from './highlight-ranges'

describe('lineInHighlightRanges', () => {
  it('tests inclusive bounds', () => {
    const ranges = [
      { start: 2, end: 4 },
      { start: 10, end: 10 },
    ]
    expect(lineInHighlightRanges(1, ranges)).toBe(false)
    expect(lineInHighlightRanges(2, ranges)).toBe(true)
    expect(lineInHighlightRanges(4, ranges)).toBe(true)
    expect(lineInHighlightRanges(10, ranges)).toBe(true)
    expect(lineInHighlightRanges(11, ranges)).toBe(false)
    expect(lineInHighlightRanges(3, undefined)).toBe(false)
  })
})

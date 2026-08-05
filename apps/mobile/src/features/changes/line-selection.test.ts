import { describe, expect, it } from 'vitest'

import type { DiffHunk } from '@/lib/daemon/procedures/changes'

import {
  anchorTextFor,
  describeRange,
  isLineInRange,
  type LineSelection,
  rangeForPath,
  rangeOf,
} from './line-selection'

const selection = (anchor: number, focus: number, path = 'src/a.ts'): LineSelection => ({
  anchor,
  focus,
  path,
})

const hunks: DiffHunk[] = [
  {
    header: '@@ -1,3 +1,4 @@',
    lines: [
      { kind: 'context', newLine: 1, oldLine: 1, text: 'one' },
      { kind: 'add', newLine: 2, oldLine: null, text: 'two' },
      { kind: 'add', newLine: 3, oldLine: null, text: 'three' },
      { kind: 'context', newLine: 4, oldLine: 2, text: 'four' },
    ],
  },
]

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

describe('anchorTextFor', () => {
  it('quotes exactly the lines the range covers', () => {
    expect(anchorTextFor(hunks, { endLine: 3, startLine: 2 })).toBe('two\nthree')
  })

  it('quotes one line for a one-line range', () => {
    expect(anchorTextFor(hunks, { endLine: 1, startLine: 1 })).toBe('one')
  })

  it('returns empty text when the range covers no anchored line', () => {
    expect(anchorTextFor(hunks, { endLine: 99, startLine: 90 })).toBe('')
  })

  it('caps the quote — it is context for the agent, not the file', () => {
    const long: DiffHunk[] = [
      {
        header: '@@',
        lines: Array.from({ length: 500 }, (_, index) => ({
          kind: 'add' as const,
          newLine: index + 1,
          oldLine: null,
          text: 'x'.repeat(50),
        })),
      },
    ]
    expect(anchorTextFor(long, { endLine: 500, startLine: 1 })).toHaveLength(2_000)
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

import type { ReadingFile } from '@backend/feature-view'
import { describe, expect, it } from 'vitest'
import { highlightRangesForFile, lineInHighlightRanges } from './highlight-ranges'

const changed = (hunks: ReadingFile['hunks']): ReadingFile => ({
  path: 'src/a.ts',
  source: 'changed',
  hunks,
})

describe('highlightRangesForFile', () => {
  it('returns undefined for non-changed sources', () => {
    expect(
      highlightRangesForFile({
        path: 'x.ts',
        source: 'shipped',
        ranges: [{ startLine: 1, lines: ['a'], gapBefore: 0 }],
      }),
    ).toBeUndefined()
  })

  it('returns undefined when there are no add lines', () => {
    expect(
      highlightRangesForFile(
        changed([
          {
            header: '@@',
            lines: [{ kind: 'del', oldLine: 1, newLine: null, text: 'gone' }],
          },
        ]),
      ),
    ).toBeUndefined()
  })

  it('coalesces contiguous add lines into ranges', () => {
    expect(
      highlightRangesForFile(
        changed([
          {
            header: '@@',
            lines: [
              { kind: 'context', oldLine: 1, newLine: 1, text: 'a' },
              { kind: 'add', oldLine: null, newLine: 2, text: 'b' },
              { kind: 'add', oldLine: null, newLine: 3, text: 'c' },
              { kind: 'context', oldLine: 2, newLine: 4, text: 'd' },
              { kind: 'add', oldLine: null, newLine: 10, text: 'e' },
            ],
          },
        ]),
      ),
    ).toEqual([
      { start: 2, end: 3 },
      { start: 10, end: 10 },
    ])
  })

  it('unions add lines across hunks', () => {
    expect(
      highlightRangesForFile(
        changed([
          {
            header: '@@1',
            lines: [{ kind: 'add', oldLine: null, newLine: 5, text: 'x' }],
          },
          {
            header: '@@2',
            lines: [{ kind: 'add', oldLine: null, newLine: 6, text: 'y' }],
          },
        ]),
      ),
    ).toEqual([{ start: 5, end: 6 }])
  })

  it('skips tint when coverage is ≥90% of lineCount (whole-file noise)', () => {
    const file = changed([
      {
        header: '@@',
        lines: Array.from({ length: 10 }, (_, i) => ({
          kind: 'add' as const,
          oldLine: null,
          newLine: i + 1,
          text: `L${i + 1}`,
        })),
      },
    ])
    expect(highlightRangesForFile(file, 10)).toBeUndefined()
    expect(highlightRangesForFile(file, 100)).toEqual([{ start: 1, end: 10 }])
  })
})

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

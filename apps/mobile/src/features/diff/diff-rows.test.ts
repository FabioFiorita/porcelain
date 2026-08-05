import { describe, expect, it } from 'vitest'

import type { DiffHunk } from '@/lib/daemon/procedures/changes'

import {
  anchorLineOf,
  anchorTextFor,
  cellAnchorLine,
  countDiffLines,
  toDiffRows,
} from './diff-rows'

/** A rewritten line (one del replaced by one add) plus surrounding context. */
const rewrite: DiffHunk = {
  header: '@@ -1,3 +1,3 @@',
  lines: [
    { kind: 'context', newLine: 1, oldLine: 1, text: 'before' },
    { kind: 'del', newLine: null, oldLine: 2, text: 'old' },
    { kind: 'add', newLine: 2, oldLine: null, text: 'new' },
    { kind: 'context', newLine: 3, oldLine: 3, text: 'after' },
  ],
}

describe('toDiffRows', () => {
  it('emits a header row then one row per line in unified mode', () => {
    const rows = toDiffRows([rewrite], 'unified')
    expect(rows.map((row) => row.kind)).toEqual([
      'header',
      'unified',
      'unified',
      'unified',
      'unified',
    ])
  })

  it('pairs a deletion with the addition that replaces it in split mode', () => {
    const rows = toDiffRows([rewrite], 'split')
    const paired = rows.find((row) => row.kind === 'split' && row.left?.kind === 'del')
    expect(paired).toBeDefined()
    if (paired?.kind !== 'split') throw new Error('expected a split row')
    expect(paired.left?.text).toBe('old')
    expect(paired.right?.text).toBe('new')
  })

  it('leaves an unmatched deletion alone on the old side', () => {
    const rows = toDiffRows(
      [
        {
          header: '@@',
          lines: [
            { kind: 'del', newLine: null, oldLine: 1, text: 'a' },
            { kind: 'del', newLine: null, oldLine: 2, text: 'b' },
            { kind: 'add', newLine: 1, oldLine: null, text: 'a2' },
          ],
        },
      ],
      'split',
    )
    const splits = rows.filter((row) => row.kind === 'split')
    // 'a' pairs with 'a2'; 'b' flushes as a left-only row when the run ends.
    expect(splits).toHaveLength(2)
    expect(splits.map((row) => (row.kind === 'split' ? row.right?.text : null))).toEqual([
      'a2',
      undefined,
    ])
  })

  it('keys rows by position, so repeated line numbers across hunks stay distinct', () => {
    const rows = toDiffRows([rewrite, rewrite], 'unified')
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('renders context lines on both sides of a split row', () => {
    const rows = toDiffRows([rewrite], 'split')
    const context = rows.find(
      (row) => row.kind === 'split' && row.left?.kind === 'context' && row.left.text === 'before',
    )
    if (context?.kind !== 'split') throw new Error('expected a split row')
    expect(context.right).toBe(context.left)
  })
})

describe('comment anchoring', () => {
  it('anchors a line to its new-side number', () => {
    expect(anchorLineOf({ kind: 'add', newLine: 7, oldLine: null, text: '' })).toBe(7)
  })

  it('falls back to the old side for a pure deletion, which has no new line', () => {
    expect(anchorLineOf({ kind: 'del', newLine: null, oldLine: 4, text: '' })).toBe(4)
  })

  it('gives a split context line one anchor — on the new side only', () => {
    const line = { kind: 'context', newLine: 9, oldLine: 9, text: '' } as const
    expect(cellAnchorLine(line, 'right')).toBe(9)
    expect(cellAnchorLine(line, 'left')).toBeUndefined()
  })

  it('lets the old side own a deletion, which the new side cannot anchor', () => {
    const line = { kind: 'del', newLine: null, oldLine: 3, text: '' } as const
    expect(cellAnchorLine(line, 'left')).toBe(3)
    expect(cellAnchorLine(line, 'right')).toBeUndefined()
  })
})

describe('anchorTextFor', () => {
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

describe('countDiffLines', () => {
  it('counts adds and dels, ignoring context', () => {
    expect(countDiffLines([rewrite])).toEqual({ additions: 1, deletions: 1 })
  })
})

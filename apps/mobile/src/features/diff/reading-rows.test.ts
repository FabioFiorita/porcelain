import type { DiffReadingOutput } from '@porcelain/contracts/git'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/comments', () => ({
  isLineInRange: (range: { startLine: number; endLine: number } | null, line?: number): boolean =>
    range !== null && line !== undefined && line >= range.startLine && line <= range.endLine,
  MAX_ANCHOR_TEXT: 2_000,
}))

import { readingPaths, toReadingRows } from './reading-rows'

const reading: DiffReadingOutput = {
  evidence: null,
  sections: [],
  groups: [
    {
      files: [
        {
          source: 'changed',
          additions: 1,
          hunks: [
            {
              header: '@@ -1 +1,2 @@',
              lines: [
                { kind: 'context', newLine: 1, oldLine: 1, text: 'a' },
                { kind: 'add', newLine: 2, oldLine: null, text: 'b' },
              ],
            },
          ],
          path: 'docs/a.md',
          status: 'modified',
        },
        { path: 'assets/logo.png', source: 'changed', status: 'modified' },
      ],
      layer: 'Docs',
    },
  ],
  name: 'Changes',
}

describe('toReadingRows', () => {
  it('stacks layer, file header, and that file’s diff rows in flow order', () => {
    expect(toReadingRows(reading, 'unified').map((row) => row.kind)).toEqual([
      'layer',
      'file',
      'diff',
      'diff',
      'diff',
      'file',
      'no-diff',
    ])
  })

  it('carries the owning path on every diff row, so a comment anchors to the right file', () => {
    const rows = toReadingRows(reading, 'unified')
    expect(rows.filter((row) => row.kind === 'diff').every((row) => row.path === 'docs/a.md')).toBe(
      true,
    )
  })

  it('marks a file with no hunks rather than dropping it from the read', () => {
    const rows = toReadingRows(reading, 'unified')
    expect(rows.some((row) => row.kind === 'no-diff' && row.path === 'assets/logo.png')).toBe(true)
  })

  it('keys rows uniquely across files, which repeat hunk positions', () => {
    const twoFiles: DiffReadingOutput = {
      evidence: null,
      sections: [],
      groups: [
        {
          files: [
            { ...reading.groups[0]?.files[0], path: 'a.ts' },
            { ...reading.groups[0]?.files[0], path: 'b.ts' },
          ].filter((file) => file.path !== undefined),
          layer: 'Other',
        },
      ],
      name: 'Changes',
    }
    const rows = toReadingRows(twoFiles, 'unified')
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })

  it('folds a collapsed file to its header, so the set still reads as a contents list', () => {
    const rows = toReadingRows(reading, 'unified', new Set(['docs/a.md']))
    expect(rows.map((row) => row.kind)).toEqual(['layer', 'file', 'file', 'no-diff'])
  })

  it('leaves other files expanded when one is collapsed', () => {
    const rows = toReadingRows(reading, 'unified', new Set(['assets/logo.png']))
    expect(rows.filter((row) => row.kind === 'diff')).toHaveLength(3)
    expect(rows.some((row) => row.kind === 'no-diff')).toBe(false)
  })

  it('honours the split layout', () => {
    const rows = toReadingRows(reading, 'split')
    const diff = rows.find((row) => row.kind === 'diff' && row.row.kind !== 'header')
    expect(diff?.kind === 'diff' && diff.row.kind).toBe('split')
  })
})

describe('readingPaths', () => {
  it('lists every file in the reading, in flow order', () => {
    expect(readingPaths(reading)).toEqual(['docs/a.md', 'assets/logo.png'])
  })
})

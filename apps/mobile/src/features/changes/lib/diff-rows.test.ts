import { describe, expect, it } from 'vitest'

import type { DiffHunk, FeatureReading } from '@/lib/daemon/procedures/changes'

import { collapsedRowIds, fileDiffRows, isLargeChange, readingRows, totalStats } from './diff-rows'
import { statusSymbol } from './status'

function hunk(lines: number, from = 1): DiffHunk {
  return {
    header: `@@ -${from},${lines} +${from},${lines} @@`,
    lines: Array.from({ length: lines }, (_unused, index) => ({
      kind: 'add' as const,
      newLine: from + index,
      oldLine: null,
      text: `line ${from + index}`,
    })),
  }
}

function reading(files: { path: string; hunks?: DiffHunk[] }[]): FeatureReading {
  return {
    groups: [
      { files: files.map((file) => ({ ...file, status: 'modified' as const })), layer: 'Docs' },
    ],
    name: 'Changes',
  }
}

describe('readingRows', () => {
  it('emits layer, file, hunk and line rows in daemon order', () => {
    const rows = readingRows(reading([{ hunks: [hunk(2)], path: 'README.md' }]))
    expect(rows.map((row) => row.kind)).toEqual(['layer', 'file', 'hunk', 'line', 'line'])
    expect(rows.every((row, index) => rows.findIndex((r) => r.key === row.key) === index)).toBe(
      true,
    )
  })

  it('caps a single file and offers its own screen', () => {
    const rows = readingRows(reading([{ hunks: [hunk(400)], path: 'src/big.ts' }]))
    expect(rows.filter((row) => row.kind === 'line')).toHaveLength(300)
    const notice = rows.at(-1)
    expect(notice).toMatchObject({ kind: 'notice', path: 'src/big.ts' })
    expect(notice?.kind === 'notice' ? notice.text : '').toContain('100 more lines')
  })

  it('caps the whole document', () => {
    const files = Array.from({ length: 40 }, (_unused, index) => ({
      hunks: [hunk(300)],
      path: `src/file-${index}.ts`,
    }))
    const rows = readingRows(reading(files))
    expect(rows).toHaveLength(6001)
    expect(rows.at(-1)).toMatchObject({ key: 'document:truncated', kind: 'notice' })
  })

  it('says so when a file carries no hunks', () => {
    const rows = readingRows(reading([{ path: 'logo.png' }]))
    expect(rows.at(-1)).toMatchObject({ kind: 'notice', text: 'Binary or unreadable — not shown' })
  })

  it('keeps a collapsed file header and hides only its following rows', () => {
    const rows = readingRows(
      reading([
        { hunks: [hunk(2)], path: 'README.md' },
        { hunks: [hunk(1)], path: 'src/app.ts' },
      ]),
    )

    expect(collapsedRowIds(rows, new Set(['README.md']))).toEqual([
      'README.md:0:h',
      'README.md:0:0',
      'README.md:0:1',
    ])
  })
})

describe('fileDiffRows', () => {
  it('renders the whole file up to the document budget', () => {
    expect(
      fileDiffRows([hunk(400)], 'src/big.ts').filter((row) => row.kind === 'line'),
    ).toHaveLength(400)
  })

  it('reports an empty diff rather than an empty screen', () => {
    expect(fileDiffRows([], 'logo.png')).toEqual([
      { key: 'logo.png:empty', kind: 'notice', text: 'Binary or unreadable — not shown' },
    ])
  })
})

describe('totals', () => {
  it('sums files and stats across groups', () => {
    expect(
      totalStats([
        { files: [{ additions: 3, deletions: 1 }, { additions: 2 }] },
        { files: [{ deletions: 4 }] },
      ]),
    ).toEqual({ additions: 5, deletions: 5, files: 3 })
  })

  it('trips the guard on file count or line count', () => {
    expect(isLargeChange({ additions: 10, deletions: 0, files: 61 })).toBe(true)
    expect(isLargeChange({ additions: 3000, deletions: 1001, files: 2 })).toBe(true)
    expect(isLargeChange({ additions: 100, deletions: 100, files: 10 })).toBe(false)
  })
})

describe('statusSymbol', () => {
  it('maps every git status, and an absent one', () => {
    expect(statusSymbol('added')).toBe('plus.circle')
    expect(statusSymbol('deleted')).toBe('minus.circle')
    expect(statusSymbol('renamed')).toBe('arrow.triangle.turn.up.right.circle')
    expect(statusSymbol(undefined)).toBe('questionmark.circle')
  })
})

import type { FlowGroup } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import { changedPaths, summarizeChanges } from './changes-summary'

const groups: FlowGroup[] = [
  {
    files: [
      { connects: [], path: 'docs/a.md', status: 'modified' },
      { connects: [], path: 'docs/b.md', status: 'added' },
    ],
    layer: 'Docs',
  },
  { files: [{ connects: [], path: 'src/c.ts', status: 'modified' }], layer: 'Other' },
]

describe('summarizeChanges', () => {
  it('counts every file across layers', () => {
    expect(summarizeChanges(groups, new Set()).total).toBe(3)
  })

  it('prints the running count with no reviewed clause while nothing is ticked', () => {
    expect(summarizeChanges(groups, new Set()).label).toBe('3 changed files')
  })

  it('adds the reviewed clause once some of the set is read', () => {
    const summary = summarizeChanges(groups, new Set(['docs/a.md']))
    expect(summary.label).toBe('3 changed files · 1 reviewed')
    expect(summary.reviewedCount).toBe(1)
    expect(summary.allReviewed).toBe(false)
  })

  it('collapses into the completion sentence when the whole set is read', () => {
    const summary = summarizeChanges(groups, new Set(['docs/a.md', 'docs/b.md', 'src/c.ts']))
    expect(summary.allReviewed).toBe(true)
    expect(summary.label).toBe('All 3 files reviewed')
  })

  it('names the base in both the running and the completed sentence', () => {
    expect(summarizeChanges(groups, new Set(), 'origin/main').label).toBe(
      '3 changed files · vs origin/main',
    )
    expect(
      summarizeChanges(groups, new Set(['docs/a.md', 'docs/b.md', 'src/c.ts']), 'origin/main')
        .label,
    ).toBe('All 3 files reviewed · vs origin/main')
  })

  it('singularizes a one-file change set', () => {
    const one = [{ files: [{ connects: [], path: 'a.ts', status: 'added' as const }], layer: 'X' }]
    expect(summarizeChanges(one, new Set()).label).toBe('1 changed file')
    expect(summarizeChanges(one, new Set(['a.ts'])).label).toBe('All 1 file reviewed')
  })

  it('is never "all reviewed" on an empty set — there is nothing to have read', () => {
    const summary = summarizeChanges([], new Set())
    expect(summary.allReviewed).toBe(false)
    expect(summary.total).toBe(0)
  })

  it('ignores reviewed marks for files outside the current set', () => {
    expect(summarizeChanges(groups, new Set(['gone.ts'])).reviewedCount).toBe(0)
  })
})

describe('changedPaths', () => {
  it('returns every path in flow order — the bulk toggle payload', () => {
    expect(changedPaths(groups)).toEqual(['docs/a.md', 'docs/b.md', 'src/c.ts'])
  })
})

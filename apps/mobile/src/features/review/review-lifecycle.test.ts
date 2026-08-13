import type { FeatureReading } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'

import { reviewedFractionOf, reviewOutlineFiles, reviewSourceCounts } from './review-lifecycle'

function readingWith(overrides: Partial<FeatureReading> = {}): FeatureReading {
  return {
    evidence: null,
    groups: [],
    name: 'Unit',
    sections: [],
    ...overrides,
  }
}

const anchored = { path: 'src/a.ts', source: 'changed' as const }
const grouped = { path: 'src/b.ts', source: 'context' as const }

describe('reviewOutlineFiles', () => {
  it('counts a file anchored in a section and left in a group exactly once', () => {
    const reading = readingWith({
      groups: [{ files: [anchored, grouped], layer: 'Support' }],
      sections: [{ files: [anchored], prose: '', title: 'Core' }],
    })
    expect(reviewOutlineFiles(reading).map((file) => file.path)).toEqual(['src/a.ts', 'src/b.ts'])
  })
})

describe('reviewSourceCounts', () => {
  it('tallies the deduped outline, so the legend cannot double-count', () => {
    const reading = readingWith({
      groups: [{ files: [anchored, grouped], layer: 'Support' }],
      sections: [{ files: [anchored], prose: '', title: 'Core' }],
    })
    expect(reviewSourceCounts(reading)).toEqual({ changed: 1, context: 1, shipped: 0 })
  })
})

describe('reviewedFractionOf', () => {
  it('measures against the deduped outline, not the raw file lists', () => {
    const reading = readingWith({
      groups: [{ files: [anchored, grouped], layer: 'Support' }],
      sections: [{ files: [anchored], prose: '', title: 'Core' }],
    })
    expect(reviewedFractionOf(reading, new Set(['src/a.ts']))).toEqual({
      fraction: 0.5,
      reviewedCount: 1,
      total: 2,
    })
  })

  it('reports zero rather than dividing by an empty outline', () => {
    expect(reviewedFractionOf(readingWith(), new Set()).fraction).toBe(0)
  })
})

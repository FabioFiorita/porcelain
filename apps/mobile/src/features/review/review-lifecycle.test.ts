import { describe, expect, it } from 'vitest'

import type { FeatureReading } from '@/lib/daemon/procedures/review'

import {
  hasIntentContent,
  isExecutionThin,
  reviewedFractionOf,
  reviewLifecyclePhase,
  reviewOutlineFiles,
  reviewSourceCounts,
  reviewStartPrompt,
} from './review-lifecycle'

const evidence = {
  checks: [{ label: 'typecheck', status: 'pass' as const }],
  medium: 'html' as const,
  title: 'Proof',
  updatedAt: '2026-08-05T10:00:00.000Z',
}

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

describe('reviewLifecyclePhase', () => {
  it('is empty without a review at all', () => {
    expect(reviewLifecyclePhase({ reading: null, reviewedFraction: 1 })).toBe('empty')
  })

  it('is ready once evidence is published, whatever is ticked off', () => {
    expect(reviewLifecyclePhase({ reading: readingWith({ evidence }), reviewedFraction: 0 })).toBe(
      'ready_to_close',
    )
  })

  it('is ready once half the outline is read, without evidence', () => {
    const reading = readingWith({ groups: [{ files: [anchored, grouped], layer: 'Support' }] })
    expect(reviewLifecyclePhase({ reading, reviewedFraction: 0.5 })).toBe('ready_to_close')
  })

  it('stays in progress when a full fraction comes from an empty outline', () => {
    expect(reviewLifecyclePhase({ reading: readingWith(), reviewedFraction: 1 })).toBe(
      'in_progress',
    )
  })
})

describe('isExecutionThin / hasIntentContent', () => {
  it('calls Execution thin while the agent has listed no files', () => {
    expect(isExecutionThin(readingWith())).toBe(true)
    expect(isExecutionThin(readingWith({ groups: [{ files: [anchored], layer: 'Core' }] }))).toBe(
      false,
    )
  })

  it('counts a thesis, a section, or a board as Intent', () => {
    expect(hasIntentContent(readingWith())).toBe(false)
    expect(hasIntentContent(readingWith({ thesis: 'the idea' }))).toBe(true)
    expect(
      hasIntentContent(readingWith({ sections: [{ files: [], prose: 'why', title: '' }] })),
    ).toBe(true)
    expect(
      hasIntentContent(readingWith({ canvas: { html: '<p>board</p>', medium: 'html' } })),
    ).toBe(true)
  })
})

describe('reviewStartPrompt', () => {
  it('leaves a placeholder when the Board suggested no name', () => {
    expect(reviewStartPrompt()).toContain('<short name: bug | feature | chore>')
  })

  it('prefills the name the Board handed over', () => {
    expect(reviewStartPrompt({ name: '  fix the picker  ' })).toContain('--name "fix the picker"')
  })
})

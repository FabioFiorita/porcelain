import type { FeatureReading } from '@backend/feature-view'
import { describe, expect, it } from 'vitest'
import {
  hasIntentContent,
  isExecutionThin,
  lifecycleBadgeLabel,
  reviewContinuePrompt,
  reviewEndPrompt,
  reviewLifecyclePhase,
  reviewOutlineFiles,
  reviewStartPrompt,
} from './review-lifecycle'

function reading(partial: Partial<FeatureReading> & Pick<FeatureReading, 'name'>): FeatureReading {
  return {
    sections: [],
    groups: [],
    evidence: null,
    ...partial,
  }
}

describe('reviewLifecyclePhase', () => {
  it('is empty with no reading', () => {
    expect(reviewLifecyclePhase({ reading: null, reviewedFraction: 0 })).toBe('empty')
  })

  it('is in_progress for Intent-only (no files, no evidence)', () => {
    const r = reading({
      name: 'Fix login flash',
      thesis: 'Stop the flash on cold load.',
    })
    expect(hasIntentContent(r)).toBe(true)
    expect(isExecutionThin(r)).toBe(true)
    expect(reviewLifecyclePhase({ reading: r, reviewedFraction: 0 })).toBe('in_progress')
    expect(lifecycleBadgeLabel('in_progress')).toBe('In progress')
  })

  it('is ready_to_close when evidence is present', () => {
    const r = reading({
      name: 'X',
      thesis: 'y',
      evidence: {
        title: 'Smoke',
        updatedAt: '2026-07-01T00:00:00Z',
        checks: [],
        medium: 'html',
      },
    })
    expect(reviewLifecyclePhase({ reading: r, reviewedFraction: 0 })).toBe('ready_to_close')
    expect(lifecycleBadgeLabel('ready_to_close')).toBe('Ready to close')
  })

  it('is ready_to_close at ≥50% reviewed when files exist', () => {
    const r = reading({
      name: 'X',
      groups: [
        {
          layer: 'UI',
          files: [
            { path: 'a.ts', source: 'changed' },
            { path: 'b.ts', source: 'changed' },
          ],
        },
      ],
    })
    expect(reviewOutlineFiles(r)).toHaveLength(2)
    expect(reviewLifecyclePhase({ reading: r, reviewedFraction: 0.5 })).toBe('ready_to_close')
    expect(reviewLifecyclePhase({ reading: r, reviewedFraction: 0.25 })).toBe('in_progress')
  })
})

describe('agent prompts', () => {
  it('start prompt is Intent-first and mentions bugs', () => {
    const p = reviewStartPrompt({ name: 'Fix null deref' })
    expect(p).toContain('START of the unit')
    expect(p).toContain('review clear')
    expect(p).toContain('Fix null deref')
    expect(p).toContain('bugs')
  })

  it('continue and end prompts name the unit', () => {
    expect(reviewContinuePrompt('Unit')).toContain('Unit')
    expect(reviewEndPrompt('Unit')).toContain('END of session')
    expect(reviewEndPrompt('Unit')).toContain('evidence prepare')
  })
})

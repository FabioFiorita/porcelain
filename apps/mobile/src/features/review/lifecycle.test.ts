import { describe, expect, it } from 'vitest'
import type { FeatureReading } from '@/lib/daemon/procedures/review'
import { lifecycleBadgeLabel, reviewLifecyclePhase } from './lifecycle'

function reading(overrides: Partial<FeatureReading> = {}): FeatureReading {
  return {
    evidence: null,
    groups: [],
    name: 'Review',
    sections: [],
    ...overrides,
  }
}

describe('reviewLifecyclePhase', () => {
  it('starts in progress for an intent-only review', () => {
    expect(reviewLifecyclePhase(reading({ thesis: 'Why' }), [])).toBe('in_progress')
    expect(lifecycleBadgeLabel('in_progress')).toBe('In progress')
  })

  it('is ready when evidence exists', () => {
    expect(
      reviewLifecyclePhase(
        reading({
          evidence: { checks: [], medium: 'html', title: 'Proof', updatedAt: 'now' },
        }),
        [],
      ),
    ).toBe('ready_to_close')
  })

  it('is ready once half of the outline is reviewed', () => {
    expect(
      reviewLifecyclePhase(
        reading({
          groups: [
            {
              files: [
                { path: 'a.ts', source: 'changed' },
                { path: 'b.ts', source: 'context' },
              ],
              layer: 'Code',
            },
          ],
        }),
        ['a.ts'],
      ),
    ).toBe('ready_to_close')
  })

  it('has no phase without a reading', () => {
    expect(reviewLifecyclePhase(null, [])).toBe('empty')
    expect(lifecycleBadgeLabel('empty')).toBeNull()
  })
})

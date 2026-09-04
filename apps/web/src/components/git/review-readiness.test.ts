import type { ReviewReadinessOutput } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewReadinessLabel } from './review-readiness'

function readiness(overrides: Partial<ReviewReadinessOutput> = {}): ReviewReadinessOutput {
  return {
    freshness: 'current',
    binding: 'live',
    canvas: { id: 'review-1' },
    coverage: { changedFileCount: 2, orderedFileCount: 2, missingPaths: [], missingCount: 0 },
    evidence: { checks: 1, passed: 1, failed: 0, skipped: 0, assets: 0 },
    ...overrides,
  }
}

describe('reviewReadinessLabel', () => {
  it('reserves ready for a current, fully ordered Review with passing evidence', () => {
    expect(reviewReadinessLabel(readiness())).toBe('Review ready')
    expect(
      reviewReadinessLabel(
        readiness({
          coverage: {
            changedFileCount: 2,
            orderedFileCount: 1,
            missingPaths: ['b.ts'],
            missingCount: 1,
          },
        }),
      ),
    ).toBe('Review incomplete')
    expect(
      reviewReadinessLabel(
        readiness({ evidence: { checks: 0, passed: 0, failed: 0, skipped: 0, assets: 0 } }),
      ),
    ).toBe('Review needs evidence')
  })

  it('keeps stale, absent, unavailable, and failed states distinct', () => {
    expect(reviewReadinessLabel(readiness({ freshness: 'stale' }))).toBe('Review stale')
    expect(reviewReadinessLabel(readiness({ freshness: 'absent' }))).toBe('Review missing')
    expect(reviewReadinessLabel(readiness({ freshness: 'unavailable' }))).toBe('Review unavailable')
    expect(
      reviewReadinessLabel(
        readiness({ evidence: { checks: 1, passed: 0, failed: 1, skipped: 0, assets: 0 } }),
      ),
    ).toBe('Review has failed checks')
  })
})

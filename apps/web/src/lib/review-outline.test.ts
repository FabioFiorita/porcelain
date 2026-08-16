import type { ReviewReading } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewOutlineFiles } from './review-outline'

function reading(partial: Partial<ReviewReading> & Pick<ReviewReading, 'name'>): ReviewReading {
  return {
    sections: [],
    groups: [],
    evidence: null,
    ...partial,
  }
}

describe('reviewOutlineFiles', () => {
  it('collects section and group files, deduped by path', () => {
    const r = reading({
      name: 'X',
      sections: [
        {
          title: 'Entry',
          prose: '',
          files: [{ path: 'a.ts', source: 'changed' }],
        },
      ],
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
    expect(reviewOutlineFiles(r).map((f) => f.path)).toEqual(['a.ts', 'b.ts'])
  })

  it('is empty for an Intent-only reading', () => {
    expect(reviewOutlineFiles(reading({ name: 'X', thesis: 'idea' }))).toHaveLength(0)
  })
})

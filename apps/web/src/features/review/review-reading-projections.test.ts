import type { ReviewReading } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { readingForIntent, readingForProcess } from './review-reading-projections'

const reading: ReviewReading = {
  name: 'Canvas split',
  thesis: 'The case stays concise.',
  sections: [
    {
      title: 'Approach',
      prose: 'Follow the flow.',
      files: [{ path: 'src/feature.ts', source: 'changed', hunks: [] }],
    },
  ],
  groups: [{ layer: 'Services', files: [{ path: 'src/service.ts', source: 'shipped' }] }],
  evidence: { title: 'Proof', updatedAt: '2026-08-15T00:00:00.000Z', checks: [] },
}

describe('Review canvas projections', () => {
  it('keeps only Intent content in the Intent projection', () => {
    expect(readingForIntent(reading)).toMatchObject({
      thesis: reading.thesis,
      sections: [],
      groups: [],
      evidence: null,
    })
  })

  it('keeps walkthrough content in Process while removing file inventory', () => {
    expect(readingForProcess(reading)).toMatchObject({
      thesis: undefined,
      sections: [{ title: 'Approach', prose: 'Follow the flow.', files: [] }],
      groups: [],
      evidence: null,
    })
  })
})

import type { ReviewReading } from '@porcelain/contracts/review'
import { describe, expect, it, vi } from 'vitest'
import { intentMarkup, processMarkup } from './review-markup'

vi.mock('@/features/files', () => ({
  markdownToHtml: (source: string): string => source,
}))

const reading: ReviewReading = {
  name: 'Canvas split',
  thesis: 'The case stays concise.',
  sections: [{ title: 'Approach', prose: 'Follow the flow.', files: [] }],
  groups: [],
  evidence: null,
}

describe('Review markup projections', () => {
  it('keeps the thesis out of Process', () => {
    expect(intentMarkup(reading)).toContain('The case stays concise.')
    expect(processMarkup(reading)).toContain('Approach')
    expect(processMarkup(reading)).toContain('Follow the flow.')
    expect(processMarkup(reading)).not.toContain('The case stays concise.')
  })

  it('returns no Process document when no walkthrough content exists', () => {
    expect(processMarkup({ ...reading, sections: [] })).toBeNull()
  })
})

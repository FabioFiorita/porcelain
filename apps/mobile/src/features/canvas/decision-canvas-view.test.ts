import { describe, expect, it } from 'vitest'

import { parseDecisionCanvas } from './decision-canvas'

const decision = {
  version: 2,
  template: 'decision',
  title: 'Choose a renderer',
  summary: 'Select the semantic rendering path.',
  options: [
    { id: 'native', name: 'Native', summary: 'Owned controls.', pros: [], cons: [], risks: [] },
    { id: 'html', name: 'HTML', summary: 'Agent markup.', pros: [], cons: [], risks: [] },
  ],
  criteria: [{ id: 'ownership', label: 'Ownership' }],
  assessments: [
    {
      optionId: 'native',
      criterionId: 'ownership',
      rating: 'strong',
      note: 'Porcelain owns presentation.',
    },
  ],
  recommendation: {
    optionId: 'native',
    summary: 'Use native semantic rendering.',
    rationale: ['Clients own presentation.'],
    confidence: 'high',
  },
}

describe('parseDecisionCanvas', () => {
  it('accepts the current semantic Decision document', () => {
    expect(parseDecisionCanvas(JSON.stringify(decision))).toMatchObject({
      error: null,
      document: { version: 2, template: 'decision' },
    })
  })

  it('rejects old structured documents instead of falling back', () => {
    expect(
      parseDecisionCanvas(JSON.stringify({ version: 1, title: 'Old', tabs: [] })),
    ).toMatchObject({
      document: null,
    })
  })

  it('reports malformed JSON', () => {
    expect(parseDecisionCanvas('{')).toEqual({
      document: null,
      error: 'Canvas content is not valid JSON.',
    })
  })
})

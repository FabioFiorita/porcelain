import { describe, expect, it } from 'vitest'

import { parseStructuredCanvas } from './structured-canvas'

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

describe('parseStructuredCanvas', () => {
  it('accepts the current semantic Decision document', () => {
    expect(parseStructuredCanvas(JSON.stringify(decision))).toMatchObject({
      error: null,
      document: { version: 2, template: 'decision' },
    })
  })

  it('rejects old structured documents instead of falling back', () => {
    expect(
      parseStructuredCanvas(JSON.stringify({ version: 1, title: 'Old', tabs: [] })),
    ).toMatchObject({
      document: null,
    })
  })

  it('reports malformed JSON', () => {
    expect(parseStructuredCanvas('{')).toEqual({
      document: null,
      error: 'Canvas content is not valid JSON.',
    })
  })

  it('normalizes persisted Why/How Review documents into ordered sections', () => {
    const parsed = parseStructuredCanvas(
      JSON.stringify({
        version: 2,
        template: 'review',
        title: 'Canvas parity',
        why: '# Why\nReview meaning belongs on every client.',
        how: '# How\nNative presentation renders the semantic document.',
      }),
    )
    expect(parsed).toMatchObject({
      error: null,
      document: {
        version: 2,
        template: 'review',
        sections: [{ title: 'Why' }, { title: 'How' }],
      },
    })
  })

  it('accepts rich Review narrative and evidence descriptors', () => {
    expect(
      parseStructuredCanvas({
        version: 2,
        template: 'review',
        title: 'Canvas parity',
        sections: [
          {
            title: 'Walkthrough',
            prose: 'Follow the contract.',
            html: '<table><tr><td>Proof</td></tr></table>',
            references: [{ path: 'src/review.ts', startLine: 3 }],
          },
        ],
        evidence: {
          checks: [{ label: 'Mobile parse', status: 'pass' }],
          assets: [{ kind: 'video', path: 'evidence/demo.mp4', label: 'Demo' }],
        },
      }),
    ).toMatchObject({
      error: null,
      document: { template: 'review', evidence: { title: 'Evidence' } },
    })
  })
})

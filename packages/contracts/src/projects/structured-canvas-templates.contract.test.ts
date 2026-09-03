import { describe, expect, it } from 'vitest'
import {
  decisionCanvasDocument,
  decisionCanvasTemplateDataSchema,
  reviewCanvasDocument,
  reviewCanvasTemplateDataSchema,
} from './structured-canvas-templates.contract'

describe('structured Canvas templates', () => {
  it('builds the semantic Decision document without presentation input', () => {
    const data = decisionCanvasTemplateDataSchema.parse({
      title: 'Choose a seam',
      summary: 'Pick the owner of Canvas presentation.',
      options: [
        { id: 'web', name: 'Web', summary: 'Web owns presentation.' },
        { id: 'daemon', name: 'Daemon', summary: 'Daemon emits presentation.' },
      ],
      criteria: [{ id: 'ownership', label: 'Ownership' }],
      assessments: [
        { optionId: 'web', criterionId: 'ownership', rating: 'strong', note: 'Matches the map.' },
      ],
      recommendation: {
        optionId: 'web',
        summary: 'Keep presentation in Web.',
        rationale: ['Clients own presentation.'],
        confidence: 'high',
      },
    })
    expect(decisionCanvasDocument(data)).toMatchObject({
      version: 2,
      template: 'decision',
      title: 'Choose a seam',
    })
  })

  it('normalizes legacy Review input with layers kept out of presentation', () => {
    const data = reviewCanvasTemplateDataSchema.parse({
      title: 'Review Decision Canvas',
      why: 'The feature needs a shared explanation.',
      how: 'The contract renders Why and How.',
      layers: [{ label: 'Contract', pattern: 'packages/contracts/.*' }],
      files: [{ path: 'packages/contracts/src/projects/structured-canvas.contract.ts' }],
    })
    expect(reviewCanvasDocument(data)).toEqual({
      version: 2,
      template: 'review',
      title: 'Review Decision Canvas',
      sections: [
        { title: 'Why', prose: 'The feature needs a shared explanation.', references: [] },
        { title: 'How', prose: 'The contract renders Why and How.', references: [] },
      ],
    })
  })

  it('builds the current rich Review document', () => {
    const data = reviewCanvasTemplateDataSchema.parse({
      title: 'Review Canvas delivery',
      summary: 'Read the contract first.',
      sections: [
        {
          title: 'Contract',
          prose: 'One semantic document.',
          references: [{ path: 'src/canvas.ts', startLine: 4 }],
        },
      ],
      evidence: {
        checks: [{ label: 'Contract tests', status: 'pass' }],
        assets: [{ kind: 'video', path: 'evidence/demo.mp4', label: 'Demo' }],
      },
    })
    expect(reviewCanvasDocument(data)).toMatchObject({
      summary: 'Read the contract first.',
      sections: [{ title: 'Contract' }],
      evidence: { title: 'Evidence', assets: [{ kind: 'video' }] },
    })
  })
})

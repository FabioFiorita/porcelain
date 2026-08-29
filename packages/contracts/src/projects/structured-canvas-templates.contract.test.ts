import { describe, expect, it } from 'vitest'
import {
  decisionCanvasDocument,
  decisionCanvasTemplateDataSchema,
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
})

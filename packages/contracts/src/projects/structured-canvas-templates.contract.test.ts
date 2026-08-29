import { describe, expect, it } from 'vitest'
import {
  decisionCanvasDocument,
  decisionCanvasTemplateDataSchema,
  planCanvasDocument,
  planCanvasTemplateDataSchema,
  reviewCanvasDocument,
  reviewCanvasTemplateDataSchema,
} from './structured-canvas-templates.contract'

describe('structured Canvas templates', () => {
  it('builds Review as Why and How without an Execution tab', () => {
    const data = reviewCanvasTemplateDataSchema.parse({
      title: 'Review',
      why: [{ type: 'markdown', content: '# Why' }],
      how: [{ type: 'html', content: '<p>How</p>' }],
      layers: [{ label: 'Contract', pattern: '^packages/contracts/' }],
    })
    expect(reviewCanvasDocument(data).tabs.map((tab) => tab.label)).toEqual(['Why', 'How'])
  })

  it('lets Plan choose bounded validated tabs and assets', () => {
    const parsed = planCanvasTemplateDataSchema.parse({
      title: 'Plan',
      tabs: [
        {
          id: 'risks',
          label: 'Risks',
          blocks: [{ type: 'markdown', content: '# Risks' }],
        },
      ],
      assets: [{ type: 'image', path: 'assets/map.png', alt: 'System map' }],
    })
    expect(planCanvasDocument(parsed)).toMatchObject({ title: 'Plan', assets: [{ type: 'image' }] })

    expect(
      planCanvasTemplateDataSchema.safeParse({
        title: 'Plan',
        tabs: Array.from({ length: 5 }, (_, index) => ({
          id: `tab-${index}`,
          label: `Tab ${index}`,
          blocks: [{ type: 'markdown', content: 'Content' }],
        })),
      }).success,
    ).toBe(false)
  })

  it('builds Decision as semantic version 2 without HTML presentation input', () => {
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

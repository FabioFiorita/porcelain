import { describe, expect, it } from 'vitest'
import {
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
})

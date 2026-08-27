import { describe, expect, it } from 'vitest'
import {
  STRUCTURED_CANVAS_MAX_ASSETS,
  STRUCTURED_CANVAS_MAX_TABS,
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from './structured-canvas.contract'

const tab = (id: string, label = id) => ({
  id,
  label,
  blocks: [{ type: 'markdown' as const, content: `# ${label}` }],
})

describe('structuredCanvasDocumentSchema', () => {
  it('accepts bounded tabs, mixed blocks, and a larger dedicated asset collection', () => {
    const parsed = structuredCanvasDocumentSchema.parse({
      version: 1,
      title: 'Release review',
      tabs: [
        tab('why', 'Why'),
        {
          id: 'details',
          label: 'Details',
          blocks: [{ type: 'html', content: '<strong>safe shape</strong>', height: 200 }],
        },
      ],
      assets: Array.from({ length: STRUCTURED_CANVAS_MAX_ASSETS }, (_, index) => ({
        type: 'image' as const,
        path: `assets/shot-${index}.png`,
        alt: `Screenshot ${index}`,
      })),
    })
    expect(parsed.assets).toHaveLength(STRUCTURED_CANVAS_MAX_ASSETS)
  })

  it('rejects too many tabs and labels that cannot fit the UI', () => {
    const parsed = structuredCanvasDocumentSchema.safeParse({
      version: 1,
      title: 'Invalid',
      tabs: [
        ...Array.from({ length: STRUCTURED_CANVAS_MAX_TABS + 1 }, (_, index) =>
          tab(`tab-${index}`),
        ),
      ],
    })
    expect(parsed.success).toBe(false)
    if (parsed.success) throw new Error('expected invalid document')
    expect(structuredCanvasValidationMessage(parsed.error)).toContain('tabs')

    expect(
      structuredCanvasDocumentSchema.safeParse({
        version: 1,
        title: 'Invalid',
        tabs: [tab('why', 'A label far too long to remain usable in a compact tab bar')],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate ids and asset traversal paths', () => {
    const parsed = structuredCanvasDocumentSchema.safeParse({
      version: 1,
      title: 'Invalid',
      tabs: [tab('why'), tab('why')],
      assets: [{ type: 'video', path: '../secret.mp4', label: 'Secret' }],
    })
    expect(parsed.success).toBe(false)
    if (parsed.success) throw new Error('expected invalid document')
    const message = structuredCanvasValidationMessage(parsed.error)
    expect(message).toContain('duplicate tab id')
    expect(message).toContain('bundle-relative')
  })
})

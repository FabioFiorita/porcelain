import { describe, expect, it } from 'vitest'
import {
  STRUCTURED_CANVAS_MAX_ASSETS,
  STRUCTURED_CANVAS_MAX_TABS,
  STRUCTURED_CANVAS_SEMANTIC_VERSION,
  STRUCTURED_CANVAS_VERSION,
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

  it('keeps version 1 documents valid while accepting semantic version 2 decisions', () => {
    expect(STRUCTURED_CANVAS_VERSION).toBe(1)
    expect(STRUCTURED_CANVAS_SEMANTIC_VERSION).toBe(2)
    expect(
      structuredCanvasDocumentSchema.parse({
        version: 1,
        title: 'Legacy plan',
        tabs: [tab('plan')],
      }).version,
    ).toBe(1)

    const parsed = structuredCanvasDocumentSchema.parse({
      version: 2,
      template: 'decision',
      title: 'Choose persistence',
      summary: 'Select the storage boundary for Canvas documents.',
      context: 'The daemon remains the only writer.',
      references: [{ path: 'apps/daemon/src/stores/canvas-store.ts', line: 12 }],
      options: [
        { id: 'sqlite', name: 'SQLite', summary: 'Store semantic JSON in SQLite.' },
        { id: 'bundle', name: 'Bundle', summary: 'Keep the current bundle boundary.' },
      ],
      criteria: [{ id: 'portability', label: 'Portability' }],
      assessments: [
        {
          optionId: 'bundle',
          criterionId: 'portability',
          rating: 'strong',
          note: 'Tracked bundles travel with Git.',
        },
      ],
      recommendation: {
        optionId: 'bundle',
        summary: 'Keep bundles.',
        rationale: ['They preserve the existing trust boundary.'],
        confidence: 'high',
        assumptions: ['Tracked Canvases remain portable.'],
        changeConditions: ['A cross-project query requirement emerges.'],
      },
    })
    expect(parsed).toMatchObject({ version: 2, template: 'decision' })
  })

  it('rejects dangling decision relationships and repository path traversal', () => {
    const parsed = structuredCanvasDocumentSchema.safeParse({
      version: 2,
      template: 'decision',
      title: 'Invalid decision',
      summary: 'Invalid references must not render.',
      references: [{ path: '../secret' }],
      options: [
        { id: 'a', name: 'A', summary: 'A' },
        { id: 'b', name: 'B', summary: 'B' },
      ],
      criteria: [{ id: 'fit', label: 'Fit' }],
      assessments: [{ optionId: 'missing', criterionId: 'fit', rating: 'poor', note: 'No.' }],
      recommendation: {
        optionId: 'missing',
        summary: 'Missing.',
        rationale: ['Invalid.'],
        confidence: 'low',
      },
    })
    expect(parsed.success).toBe(false)
    if (parsed.success) throw new Error('expected invalid document')
    const message = structuredCanvasValidationMessage(parsed.error)
    expect(message).toContain('repository-relative')
    expect(message).toContain('unknown option id')
  })
})

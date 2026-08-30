import { describe, expect, it } from 'vitest'
import {
  STRUCTURED_CANVAS_VERSION,
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from './structured-canvas.contract'

const decision = {
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
} as const

describe('structuredCanvasDocumentSchema', () => {
  it('accepts current semantic Decision and Review documents', () => {
    expect(STRUCTURED_CANVAS_VERSION).toBe(2)
    expect(structuredCanvasDocumentSchema.parse(decision)).toMatchObject({
      version: 2,
      template: 'decision',
    })
    expect(
      structuredCanvasDocumentSchema.parse({
        version: 2,
        template: 'review',
        title: 'Review the Decision Canvas',
        why: 'The renderer must preserve explanation.',
        how: 'Review stores semantic Why and How sections.',
      }),
    ).toMatchObject({ version: 2, template: 'review' })
  })

  it('rejects version 1 documents instead of carrying a compatibility renderer', () => {
    expect(
      structuredCanvasDocumentSchema.safeParse({
        version: 1,
        title: 'Old plan',
        tabs: [{ id: 'plan', label: 'Plan', blocks: [{ type: 'markdown', content: 'Old' }] }],
      }).success,
    ).toBe(false)
  })

  it('rejects dangling decision relationships and repository path traversal', () => {
    const parsed = structuredCanvasDocumentSchema.safeParse({
      ...decision,
      title: 'Invalid decision',
      references: [{ path: '../secret' }],
      assessments: [
        { optionId: 'missing', criterionId: 'portability', rating: 'poor', note: 'No.' },
      ],
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

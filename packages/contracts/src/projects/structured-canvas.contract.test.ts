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
  it('accepts current semantic Decision and normalizes legacy Review documents', () => {
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
    ).toMatchObject({
      version: 2,
      template: 'review',
      sections: [
        { title: 'Why', prose: 'The renderer must preserve explanation.' },
        { title: 'How', prose: 'Review stores semantic Why and How sections.' },
      ],
    })
  })

  it('accepts ordered Review narrative, code anchors, sandbox visuals, and evidence assets', () => {
    expect(
      structuredCanvasDocumentSchema.parse({
        version: 2,
        template: 'review',
        title: 'Review the review',
        summary: 'Start with the contract and finish with proof.',
        sections: [
          {
            title: 'Contract',
            prose: 'The shared shape changed.',
            svg: '<svg><circle cx="5" cy="5" r="5" /></svg>',
            html: '<table><tr><td>Current</td></tr></table>',
            references: [{ path: 'src/review.ts', startLine: 10, endLine: 20 }],
          },
        ],
        evidence: {
          checks: [{ label: 'Focused tests', status: 'pass', detail: '12 passed' }],
          assets: [
            { kind: 'image', path: 'evidence/screenshot.png', label: 'Browser result' },
            { kind: 'link', href: 'https://example.com/run', label: 'CI run' },
          ],
        },
      }),
    ).toMatchObject({
      sections: [{ title: 'Contract', references: [{ startLine: 10, endLine: 20 }] }],
      evidence: { title: 'Evidence', checks: [{ status: 'pass' }] },
    })
  })

  it('rejects inverted Review code ranges', () => {
    expect(
      structuredCanvasDocumentSchema.safeParse({
        version: 2,
        template: 'review',
        title: 'Unsafe review',
        sections: [
          {
            title: 'Unsafe',
            prose: '',
            references: [{ path: 'src/a.ts', startLine: 20, endLine: 10 }],
          },
        ],
        evidence: {
          assets: [],
        },
      }).success,
    ).toBe(false)
  })

  it.each(['../secret.png', '/secret.png', 'C:/secret.png', 'evidence\\secret.png'])(
    'rejects Review asset path %s outside the bundle namespace',
    (path) => {
      expect(
        structuredCanvasDocumentSchema.safeParse({
          version: 2,
          template: 'review',
          title: 'Unsafe review',
          sections: [{ title: 'Unsafe', prose: '', references: [] }],
          evidence: { assets: [{ kind: 'image', path, label: 'Secret' }] },
        }).success,
      ).toBe(false)
    },
  )

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

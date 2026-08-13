import { describe, expect, it } from 'vitest'
import {
  activeReviewOutputSchema,
  evidenceAssetBodySchema,
  evidenceAssetDescriptorSchema,
  evidenceDocDescriptorSchema,
  reviewCommentSchema,
  reviewEvidenceOutputSchema,
  reviewEvidenceSchema,
  reviewInboxRowSchema,
  reviewIntentOutputSchema,
  reviewReadingOutputSchema,
  reviewReadingSchema,
} from './review.contract'

const updatedAt = '2026-01-01T00:00:00.000Z'
const check = { label: 'lint', status: 'pass' } as const
const readingFile = { path: 'src/changed.ts', source: 'changed' } as const
const group = { layer: 'Source', files: [readingFile] } as const
const section = { title: 'Section', prose: 'Why this holds', files: [readingFile] } as const

const reading = {
  name: 'Synthetic review',
  sections: [section],
  groups: [group],
  evidence: { title: 'Evidence', updatedAt, checks: [check] },
}

const activeReview = {
  name: 'Synthetic review',
  fromAgent: true,
  sections: [{ title: 'Section', anchorCount: 1 }],
  groups: [group],
}

const docDescriptor = {
  file: 'results.md',
  label: 'Results',
  medium: 'markdown',
  bytes: 128,
  state: 'available',
} as const

const docDescriptorUnavailable = {
  file: 'results.md',
  label: 'Results',
  medium: 'markdown',
  bytes: 9_000_000,
  state: 'unavailable',
  reason: 'too-large',
  maxBytes: 2 * 1024 * 1024,
} as const

const assetDescriptor = {
  file: '01-before.png',
  label: 'Before',
  kind: 'image',
  mime: 'image/png',
  bytes: 2048,
  state: 'available',
} as const

const assetDescriptorUnavailable = {
  file: '01-before.png',
  label: 'Before',
  kind: 'image',
  mime: 'image/png',
  bytes: 20_000_000,
  state: 'unavailable',
  reason: 'too-large',
  maxBytes: 8 * 1024 * 1024,
} as const

const evidence = {
  title: 'Evidence',
  updatedAt,
  checks: [check],
  results: [docDescriptor],
  assets: [assetDescriptor],
}

describe('Evidence aggregate', () => {
  it('rejects the retired markers and any inline body', () => {
    for (const extra of [{ medium: 'html' }, { hasReport: true }, { dir: '/abs/evidence' }]) {
      expect(reviewEvidenceSchema.safeParse({ ...evidence, ...extra }).success).toBe(false)
    }
    expect(
      reviewEvidenceSchema.safeParse({
        ...evidence,
        results: [{ ...docDescriptor, body: '# Results' }],
      }).success,
    ).toBe(false)
    expect(
      reviewEvidenceSchema.safeParse({
        ...evidence,
        assets: [{ ...assetDescriptor, dataUrl: 'data:image/png;base64,AA==' }],
      }).success,
    ).toBe(false)
  })

  it('round-trips both descriptor states and requires the unavailable reason', () => {
    expect(evidenceDocDescriptorSchema.safeParse(docDescriptor).success).toBe(true)
    expect(evidenceDocDescriptorSchema.safeParse(docDescriptorUnavailable).success).toBe(true)
    expect(evidenceAssetDescriptorSchema.safeParse(assetDescriptor).success).toBe(true)
    expect(evidenceAssetDescriptorSchema.safeParse(assetDescriptorUnavailable).success).toBe(true)

    const { reason: _reason, ...withoutReason } = docDescriptorUnavailable
    expect(evidenceDocDescriptorSchema.safeParse(withoutReason).success).toBe(false)
    const { maxBytes: _maxBytes, ...withoutMax } = assetDescriptorUnavailable
    expect(evidenceAssetDescriptorSchema.safeParse(withoutMax).success).toBe(false)
    expect(
      evidenceDocDescriptorSchema.safeParse({ ...docDescriptorUnavailable, reason: 'missing' })
        .success,
    ).toBe(false)
  })

  it('rejects an uncontained descriptor file name', () => {
    for (const file of ['../escape.png', 'a/b.png', '.hidden.png', 'a\\b.png', '']) {
      expect(evidenceAssetDescriptorSchema.safeParse({ ...assetDescriptor, file }).success).toBe(
        false,
      )
      expect(evidenceDocDescriptorSchema.safeParse({ ...docDescriptor, file }).success).toBe(false)
    }
  })

  it('separates the absent pack from a checks-only pack', () => {
    expect(reviewEvidenceOutputSchema.safeParse(null).success).toBe(true)
    expect(
      reviewEvidenceOutputSchema.safeParse({
        title: 'Evidence',
        updatedAt,
        checks: [check],
        results: [],
        assets: [],
      }).success,
    ).toBe(true)
  })

  it('retains the descriptor and asset-body caps', () => {
    expect(
      reviewEvidenceSchema.safeParse({ ...evidence, results: Array(12).fill(docDescriptor) })
        .success,
    ).toBe(true)
    expect(
      reviewEvidenceSchema.safeParse({ ...evidence, results: Array(13).fill(docDescriptor) })
        .success,
    ).toBe(false)
    expect(
      reviewEvidenceSchema.safeParse({ ...evidence, assets: Array(60).fill(assetDescriptor) })
        .success,
    ).toBe(true)
    expect(
      reviewEvidenceSchema.safeParse({ ...evidence, assets: Array(61).fill(assetDescriptor) })
        .success,
    ).toBe(false)
    expect(
      reviewEvidenceSchema.safeParse({
        ...evidence,
        checks: Array(33).fill({ label: 'check', status: 'pass' }),
      }).success,
    ).toBe(false)
    expect(
      evidenceAssetBodySchema.safeParse({
        file: '01-before.png',
        mime: 'image/png',
        bytes: 8 * 1024 * 1024 + 1,
        dataUrl: 'data:image/png;base64,AA==',
      }).success,
    ).toBe(false)
  })
})

describe('Reading and active review', () => {
  it('drops the scene canvas and the evidence medium marker', () => {
    expect(reviewReadingSchema.safeParse(reading).success).toBe(true)
    expect(
      reviewReadingSchema.safeParse({ ...reading, canvas: { medium: 'html', html: '<p>x</p>' } })
        .success,
    ).toBe(false)
    expect(
      reviewReadingSchema.safeParse({
        ...reading,
        evidence: { ...reading.evidence, medium: 'html' },
      }).success,
    ).toBe(false)
  })

  it('keeps the empty review distinct from no review', () => {
    expect(activeReviewOutputSchema.safeParse(null).success).toBe(true)
    expect(
      activeReviewOutputSchema.safeParse({
        name: '',
        fromAgent: false,
        sections: [],
        groups: [],
      }).success,
    ).toBe(true)
    expect(activeReviewOutputSchema.safeParse(activeReview).success).toBe(true)
    expect(reviewReadingOutputSchema.safeParse(null).success).toBe(true)
    expect(reviewReadingSchema.safeParse(null).success).toBe(false)
    expect(reviewReadingSchema.safeParse({ ...reading, evidence: null }).success).toBe(true)
  })

  it('accepts every reading discriminator', () => {
    for (const source of ['changed', 'context', 'shipped'] as const) {
      expect(
        reviewReadingSchema.safeParse({
          ...reading,
          groups: [{ layer: 'Source', files: [{ path: 'src/file.ts', source }] }],
        }).success,
      ).toBe(true)
    }

    for (const status of ['modified', 'added', 'deleted', 'renamed', 'untracked'] as const) {
      expect(
        activeReviewOutputSchema.safeParse({
          ...activeReview,
          groups: [
            { layer: 'Source', files: [{ path: 'src/file.ts', source: 'changed', status }] },
          ],
        }).success,
      ).toBe(true)
    }

    for (const kind of ['context', 'add', 'del'] as const) {
      expect(
        reviewReadingSchema.safeParse({
          ...reading,
          sections: [
            {
              ...section,
              files: [
                {
                  path: 'src/file.ts',
                  source: 'changed',
                  hunks: [
                    { header: '@@', lines: [{ kind, oldLine: null, newLine: null, text: 'x' }] },
                  ],
                },
              ],
            },
          ],
        }).success,
      ).toBe(true)
    }
  })

  it('rejects unknown fields through nested strict Review values', () => {
    expect(
      reviewReadingSchema.safeParse({
        ...reading,
        groups: [{ ...group, files: [{ ...readingFile, extra: true }] }],
      }).success,
    ).toBe(false)
    expect(
      activeReviewOutputSchema.safeParse({
        ...activeReview,
        groups: [{ ...group, files: [{ ...readingFile, extra: true }] }],
      }).success,
    ).toBe(false)
    expect(
      reviewInboxRowSchema.safeParse({
        path: '/synthetic/repo',
        branch: 'main',
        changedCount: 1,
        hasReview: true,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      reviewCommentSchema.safeParse({
        id: 'c1',
        path: 'src/changed.ts',
        body: 'x',
        resolved: false,
        createdAt: 1,
        agentReply: { body: 'y', createdAt: 2, extra: true },
      }).success,
    ).toBe(false)
  })
})

describe('Review documents', () => {
  it('keeps both media on the shared document primitive and caps the Intent list', () => {
    const markdown = { file: 'intent.md', label: 'Intent', medium: 'markdown', body: 'x' } as const
    const html = { file: 'intent.html', label: 'Intent', medium: 'html', body: '<p>x</p>' } as const
    expect(reviewIntentOutputSchema.safeParse([markdown, html]).success).toBe(true)
    expect(reviewIntentOutputSchema.safeParse([{ ...markdown, medium: 'pdf' }]).success).toBe(false)
    expect(reviewIntentOutputSchema.safeParse([{ ...markdown, extra: true }]).success).toBe(false)
    expect(reviewIntentOutputSchema.safeParse(Array(12).fill(markdown)).success).toBe(true)
    expect(reviewIntentOutputSchema.safeParse(Array(13).fill(markdown)).success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { reviewContractFixtures } from './review.contract'
import { reviewProcedures } from './review.procedures'

const expectedKinds = {
  worktreeInbox: 'query',
  markReviewed: 'mutation',
  unmarkReviewed: 'mutation',
  reviewedPaths: 'query',
  setReviewed: 'mutation',
  featureView: 'query',
  featureReading: 'query',
  clearFeatureReview: 'mutation',
  reviewIntent: 'query',
  reviewEvidenceDocs: 'query',
  reviewEvidenceAssets: 'query',
  reviewEvidenceAsset: 'query',
  reviewPublishCost: 'query',
  publishReview: 'mutation',
  archivedReviews: 'query',
  restoreArchivedReview: 'mutation',
  deleteArchivedReview: 'mutation',
  loopEvidence: 'query',
  loopEvidenceHtml: 'query',
  clearLoopEvidence: 'mutation',
  reviewComments: 'query',
  addReviewComment: 'mutation',
  editReviewComment: 'mutation',
  deleteReviewComment: 'mutation',
  clearResolvedReviewComments: 'mutation',
  resolveReviewComment: 'mutation',
  exploreFeature: 'query',
} as const

const expectedCommentErrors = {
  reviewComments: ['review.unavailable'],
  addReviewComment: ['review.unavailable', 'request.invalid'],
  editReviewComment: ['review.unavailable', 'review.comment-not-found'],
  deleteReviewComment: ['review.unavailable', 'review.comment-not-found'],
  resolveReviewComment: ['review.unavailable', 'review.comment-not-found'],
  clearResolvedReviewComments: ['review.unavailable'],
} as const

const invalidInputs: Record<keyof typeof reviewProcedures, unknown> = {
  worktreeInbox: 42,
  markReviewed: { repoPath: '/synthetic/repo' },
  unmarkReviewed: null,
  reviewedPaths: 42,
  setReviewed: { repoPath: '/synthetic/repo', paths: [42] },
  featureView: 42,
  featureReading: null,
  clearFeatureReview: 42,
  reviewIntent: null,
  reviewEvidenceDocs: 42,
  reviewEvidenceAssets: null,
  reviewEvidenceAsset: { repoPath: '/synthetic/repo', file: '' },
  reviewPublishCost: 42,
  publishReview: null,
  archivedReviews: 42,
  restoreArchivedReview: { repoPath: '/synthetic/repo', id: '' },
  deleteArchivedReview: null,
  loopEvidence: 42,
  loopEvidenceHtml: null,
  clearLoopEvidence: 42,
  reviewComments: null,
  addReviewComment: {
    repoPath: '/synthetic/repo',
    path: '',
    body: '',
  },
  editReviewComment: { repoPath: '/synthetic/repo', id: 'comment-synthetic', body: '' },
  deleteReviewComment: { repoPath: '/synthetic/repo' },
  clearResolvedReviewComments: null,
  resolveReviewComment: { repoPath: '/synthetic/repo', id: 'comment-synthetic', resolved: 'true' },
  exploreFeature: {
    repoPath: '/synthetic/repo',
    seed: { kind: 'module', path: 'src/changed.ts' },
  },
}

const invalidOutputs: Record<keyof typeof reviewProcedures, unknown> = {
  worktreeInbox: [{ path: '/synthetic/repo-worktrees/topic', branch: 'topic', changedCount: '2' }],
  markReviewed: null,
  unmarkReviewed: null,
  reviewedPaths: [42],
  setReviewed: null,
  featureView: { ...reviewContractFixtures.featureView.output, fromAgent: 'true' },
  featureReading: {
    ...reviewContractFixtures.featureReading.output,
    evidence: { title: 'Evidence', updatedAt: '', checks: [], medium: 'text' },
  },
  clearFeatureReview: null,
  reviewIntent: [{ file: 'intent.pdf', label: 'Intent', medium: 'pdf', body: 'x' }],
  reviewEvidenceDocs: [{ ...reviewContractFixtures.reviewEvidenceDocs.output[0], body: 42 }],
  reviewEvidenceAssets: [
    { ...reviewContractFixtures.reviewEvidenceAssets.output[0], kind: 'document' },
  ],
  reviewEvidenceAsset: { ...reviewContractFixtures.reviewEvidenceAsset.output, dataUrl: 42 },
  reviewPublishCost: { bytes: '2048', files: 4 },
  publishReview: { id: 42, cost: { bytes: 2048, files: 4 } },
  archivedReviews: [{ ...reviewContractFixtures.archivedReviews.output[0], archivedAt: 42 }],
  restoreArchivedReview: null,
  deleteArchivedReview: null,
  loopEvidence: { ...reviewContractFixtures.loopEvidence.output, medium: 'markdown' },
  loopEvidenceHtml: { ...reviewContractFixtures.loopEvidenceHtml.output, html: 42 },
  clearLoopEvidence: null,
  reviewComments: [{ ...reviewContractFixtures.reviewComments.output[0], resolved: 'false' }],
  addReviewComment: {
    ...reviewContractFixtures.addReviewComment.output,
    agentReply: { body: 42, createdAt: 1 },
  },
  editReviewComment: null,
  deleteReviewComment: null,
  clearResolvedReviewComments: null,
  resolveReviewComment: null,
  exploreFeature: {
    ...reviewContractFixtures.exploreFeature.output,
    groups: [{ layer: 'Source' }],
  },
}

describe('Review procedure contracts', () => {
  it('declares exactly twenty-seven procedures with their router kinds', () => {
    expect(Object.keys(reviewProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(reviewProcedures[name as keyof typeof reviewProcedures].kind).toBe(kind)
    }
  })

  it('declares the six comment procedure public error codes', () => {
    for (const [name, errors] of Object.entries(expectedCommentErrors)) {
      expect([...reviewProcedures[name as keyof typeof expectedCommentErrors].errors]).toEqual([
        ...errors,
      ])
    }
  })

  it('rejects blank comment ids before they can reach non-empty not-found error details', () => {
    expect(
      reviewProcedures.editReviewComment.input.safeParse({ repoPath: '/repo', id: '', body: 'x' })
        .success,
    ).toBe(false)
    expect(
      reviewProcedures.deleteReviewComment.input.safeParse({ repoPath: '/repo', id: '' }).success,
    ).toBe(false)
    expect(
      reviewProcedures.resolveReviewComment.input.safeParse({
        repoPath: '/repo',
        id: '',
        resolved: true,
      }).success,
    ).toBe(false)
  })

  for (const name of Object.keys(reviewProcedures) as Array<keyof typeof reviewProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = reviewContractFixtures[name]
      const procedure = reviewProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = reviewProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('accepts every reading, document, evidence, and explore discriminator', () => {
    const reading = reviewContractFixtures.featureReading.output
    for (const source of ['changed', 'context', 'shipped'] as const) {
      expect(
        reviewProcedures.featureReading.output.safeParse({
          ...reading,
          groups: [{ layer: 'Source', files: [{ path: 'src/file.ts', source }] }],
        }).success,
      ).toBe(true)
    }

    for (const status of ['modified', 'added', 'deleted', 'renamed', 'untracked'] as const) {
      expect(
        reviewProcedures.featureView.output.safeParse({
          ...reviewContractFixtures.featureView.output,
          groups: [
            {
              layer: 'Source',
              files: [{ path: 'src/file.ts', source: 'changed', status, connects: [] }],
            },
          ],
        }).success,
      ).toBe(true)
    }

    for (const kind of ['context', 'add', 'del'] as const) {
      expect(
        reviewProcedures.featureReading.output.safeParse({
          ...reading,
          sections: [
            {
              ...reading.sections[0],
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

    expect(
      reviewProcedures.reviewIntent.output.safeParse([
        { file: 'intent.md', label: 'Intent', medium: 'markdown', body: 'x' },
        { file: 'intent.html', label: 'Intent HTML', medium: 'html', body: '<p>x</p>' },
      ]).success,
    ).toBe(true)
    expect(
      reviewProcedures.featureReading.output.safeParse({
        ...reading,
        canvas: { medium: 'html', html: '<p>x</p>' },
      }).success,
    ).toBe(true)
    expect(
      reviewProcedures.exploreFeature.input.safeParse({
        repoPath: '/synthetic/repo',
        seed: { kind: 'file', path: 'src/file.ts' },
      }).success,
    ).toBe(true)
    expect(
      reviewProcedures.loopEvidenceHtml.output.safeParse({
        ...(() => {
          const { html: _html, ...withoutHtml } = reviewContractFixtures.loopEvidenceHtml.output
          return withoutHtml
        })(),
        htmlUnavailable: { reason: 'too-large', bytes: 5_000_000, maxBytes: 4_194_304 },
      }).success,
    ).toBe(true)
  })

  it('accepts every nullable Review result branch', () => {
    for (const name of [
      'featureView',
      'featureReading',
      'reviewEvidenceAsset',
      'publishReview',
      'loopEvidence',
      'loopEvidenceHtml',
    ] as const) {
      expect(reviewProcedures[name].output.safeParse(null).success).toBe(true)
    }
    expect(
      reviewProcedures.featureReading.output.safeParse({
        ...reviewContractFixtures.featureReading.output,
        evidence: null,
      }).success,
    ).toBe(true)
  })

  it('keeps exploreFeature non-null while featureReading remains nullable', () => {
    expect(reviewProcedures.featureReading.output.safeParse(null).success).toBe(true)
    expect(reviewProcedures.exploreFeature.output.safeParse(null).success).toBe(false)
    expect(
      reviewProcedures.exploreFeature.output.safeParse(reviewContractFixtures.exploreFeature.output)
        .success,
    ).toBe(true)
  })

  it('preserves input bounds, normalization, nullability, and void results', () => {
    expect(
      reviewProcedures.reviewEvidenceAsset.input.safeParse({
        repoPath: '/synthetic/repo',
        file: '',
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.addReviewComment.input.safeParse({
        ...reviewContractFixtures.addReviewComment.input,
        startLine: 0,
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.addReviewComment.input.safeParse({
        ...reviewContractFixtures.addReviewComment.input,
        endLine: 1.5,
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.restoreArchivedReview.input.safeParse({
        repoPath: '/synthetic/repo',
        id: '',
      }).success,
    ).toBe(false)

    for (const [name, procedure] of Object.entries(reviewProcedures)) {
      if (expectedKinds[name as keyof typeof expectedKinds] !== 'mutation') continue
      if (name === 'publishReview' || name === 'addReviewComment') continue
      expect(procedure.output.safeParse(undefined).success).toBe(true)
    }
  })

  it('rejects unknown fields through nested strict Review values', () => {
    const reading = reviewContractFixtures.featureReading.output
    expect(
      reviewProcedures.featureReading.output.safeParse({
        ...reading,
        groups: [
          {
            ...reading.groups[0],
            files: [{ ...reading.groups[0].files[0], extra: true }],
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.featureView.output.safeParse({
        ...reviewContractFixtures.featureView.output,
        groups: [
          {
            ...reviewContractFixtures.featureView.output.groups[0],
            files: [
              { ...reviewContractFixtures.featureView.output.groups[0].files[0], extra: true },
            ],
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.reviewIntent.output.safeParse([
        { ...reviewContractFixtures.reviewIntent.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      reviewProcedures.loopEvidence.output.safeParse({
        ...reviewContractFixtures.loopEvidence.output,
        checks: [{ ...reviewContractFixtures.loopEvidence.output.checks[0], extra: true }],
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.reviewComments.output.safeParse([
        {
          ...reviewContractFixtures.reviewComments.output[0],
          agentReply: {
            ...reviewContractFixtures.reviewComments.output[0].agentReply,
            extra: true,
          },
        },
      ]).success,
    ).toBe(false)
    expect(
      reviewProcedures.worktreeInbox.output.safeParse([
        { ...reviewContractFixtures.worktreeInbox.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      reviewProcedures.setReviewed.input.safeParse({
        ...reviewContractFixtures.setReviewed.input,
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('retains evidence and document caps', () => {
    const document = { file: 'report.md', label: 'Report', medium: 'markdown', body: 'x' } as const
    expect(reviewProcedures.reviewIntent.output.safeParse(Array(12).fill(document)).success).toBe(
      true,
    )
    expect(reviewProcedures.reviewIntent.output.safeParse(Array(13).fill(document)).success).toBe(
      false,
    )
    expect(
      reviewProcedures.reviewEvidenceAssets.output.safeParse(
        Array(60).fill(reviewContractFixtures.reviewEvidenceAssets.output[0]),
      ).success,
    ).toBe(true)
    expect(
      reviewProcedures.reviewEvidenceAssets.output.safeParse(
        Array(61).fill(reviewContractFixtures.reviewEvidenceAssets.output[0]),
      ).success,
    ).toBe(false)
    expect(
      reviewProcedures.loopEvidence.output.safeParse({
        ...reviewContractFixtures.loopEvidence.output,
        checks: Array(33).fill({ label: 'check', status: 'pass' }),
      }).success,
    ).toBe(false)
    expect(
      reviewProcedures.reviewEvidenceAsset.output.safeParse({
        ...reviewContractFixtures.reviewEvidenceAsset.output,
        bytes: 8 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false)
  })
})

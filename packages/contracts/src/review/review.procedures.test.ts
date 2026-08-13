import { describe, expect, it } from 'vitest'
import { procedureCatalog } from '../procedure-catalog'
import { reviewContractFixtures } from './review.contract'
import {
  REVIEW_CHANGE_KINDS,
  reviewChangeSchema,
  reviewNotificationFixtures,
} from './review.notifications'
import {
  REVIEW_STALE_ON_REVIEW_CHANGED,
  type ReviewProcedureName,
  reviewProcedures,
} from './review.procedures'

const repoPath = '/synthetic/repo'
const updatedAt = '2026-01-01T00:00:00.000Z'

const readingFile = { path: 'src/changed.ts', source: 'changed' } as const
const group = { layer: 'Source', files: [readingFile] } as const
const section = { title: 'Section', prose: 'Why this holds', files: [readingFile] } as const
const check = { label: 'lint', status: 'pass' } as const

const activeReview = {
  name: 'Synthetic review',
  fromAgent: true,
  sections: [{ title: 'Section', anchorCount: 1 }],
  groups: [group],
}

const reading = {
  name: 'Synthetic review',
  sections: [section],
  groups: [group],
  evidence: { title: 'Evidence', updatedAt, checks: [check] },
}

const doc = { file: 'results.md', label: 'Results', medium: 'markdown', body: '# Results' } as const

const docDescriptor = {
  file: 'results.md',
  label: 'Results',
  medium: 'markdown',
  bytes: 128,
  state: 'available',
} as const

const assetDescriptor = {
  file: '01-before.png',
  label: 'Before',
  kind: 'image',
  mime: 'image/png',
  bytes: 2048,
  state: 'available',
} as const

const evidence = {
  title: 'Evidence',
  updatedAt,
  checks: [check],
  results: [docDescriptor],
  assets: [assetDescriptor],
}

const assetBody = {
  file: '01-before.png',
  mime: 'image/png',
  bytes: 2048,
  dataUrl: 'data:image/png;base64,AA==',
}

const comment = {
  id: 'comment-synthetic',
  path: 'src/changed.ts',
  body: 'Anchor this claim.',
  resolved: false,
  createdAt: 1,
}

const publishCost = { bytes: 2048, files: 4 }

/** The canonical order: twelve queries, then eleven mutations. */
const expectedKinds = {
  reviewInbox: 'query',
  reviewedPaths: 'query',
  activeReview: 'query',
  reviewReading: 'query',
  exploreReading: 'query',
  reviewIntent: 'query',
  reviewEvidence: 'query',
  reviewEvidenceDoc: 'query',
  reviewEvidenceAsset: 'query',
  publishCost: 'query',
  archivedReviews: 'query',
  reviewComments: 'query',
  setReviewed: 'mutation',
  archiveReview: 'mutation',
  clearEvidence: 'mutation',
  publishReview: 'mutation',
  restoreArchivedReview: 'mutation',
  deleteArchivedReview: 'mutation',
  addReviewComment: 'mutation',
  editReviewComment: 'mutation',
  deleteReviewComment: 'mutation',
  clearResolvedReviewComments: 'mutation',
  resolveReviewComment: 'mutation',
} as const

const expectedCommentErrors = {
  reviewComments: ['review.unavailable'],
  addReviewComment: ['review.unavailable', 'request.invalid'],
  editReviewComment: ['review.unavailable', 'review.comment-not-found'],
  deleteReviewComment: ['review.unavailable', 'review.comment-not-found'],
  clearResolvedReviewComments: ['review.unavailable'],
  resolveReviewComment: ['review.unavailable', 'review.comment-not-found'],
} as const

/** Names the Review vocabulary must never resurrect (moved here by REV-009). */
const retiredNames = [
  'markReviewed',
  'unmarkReviewed',
  'reviewEvidenceDocs',
  'reviewEvidenceAssets',
  'loopEvidence',
  'loopEvidenceHtml',
  'clearLoopEvidence',
  'reviewPublishCost',
  'worktreeInbox',
  'featureView',
  'featureReading',
  'exploreFeature',
  'clearFeatureReview',
  'completeReview',
]

type Fixture = { input: unknown; output: unknown }

const fixtures: Record<ReviewProcedureName, Fixture> = {
  reviewInbox: {
    input: repoPath,
    output: [{ path: repoPath, branch: 'main', changedCount: 2, hasReview: true }],
  },
  reviewedPaths: { input: repoPath, output: ['src/changed.ts'] },
  activeReview: { input: repoPath, output: activeReview },
  reviewReading: { input: repoPath, output: reading },
  exploreReading: {
    input: { repoPath, seed: { kind: 'file', path: 'src/changed.ts' } },
    output: reading,
  },
  reviewIntent: { input: repoPath, output: [doc] },
  reviewEvidence: { input: repoPath, output: evidence },
  reviewEvidenceDoc: { input: { repoPath, file: 'results.md' }, output: doc },
  reviewEvidenceAsset: { input: { repoPath, file: '01-before.png' }, output: assetBody },
  publishCost: { input: repoPath, output: publishCost },
  archivedReviews: {
    input: repoPath,
    output: [{ id: 'review-1', name: 'Synthetic review', archivedAt: updatedAt }],
  },
  reviewComments: { input: repoPath, output: [comment] },
  setReviewed: {
    input: { repoPath, paths: ['src/changed.ts'], reviewed: true },
    output: undefined,
  },
  archiveReview: { input: repoPath, output: undefined },
  clearEvidence: { input: repoPath, output: undefined },
  publishReview: { input: repoPath, output: { id: 'review-1', cost: publishCost } },
  restoreArchivedReview: { input: { repoPath, id: 'review-1' }, output: undefined },
  deleteArchivedReview: { input: { repoPath, id: 'review-1' }, output: undefined },
  addReviewComment: {
    input: { repoPath, path: 'src/changed.ts', body: 'Anchor this claim.' },
    output: comment,
  },
  editReviewComment: {
    input: { repoPath, id: 'comment-synthetic', body: 'Rewritten.' },
    output: undefined,
  },
  deleteReviewComment: { input: { repoPath, id: 'comment-synthetic' }, output: undefined },
  clearResolvedReviewComments: { input: { repoPath }, output: undefined },
  resolveReviewComment: {
    input: { repoPath, id: 'comment-synthetic', resolved: true },
    output: undefined,
  },
}

const invalidInputs: Record<ReviewProcedureName, unknown> = {
  reviewInbox: 42,
  reviewedPaths: '',
  activeReview: null,
  reviewReading: 42,
  exploreReading: { repoPath, seed: { kind: 'module', path: 'src/changed.ts' } },
  reviewIntent: '',
  reviewEvidence: null,
  reviewEvidenceDoc: { repoPath, file: '' },
  reviewEvidenceAsset: { repoPath, file: '' },
  publishCost: 42,
  archivedReviews: '',
  reviewComments: null,
  setReviewed: { repoPath, paths: [], reviewed: true },
  archiveReview: 42,
  clearEvidence: '',
  publishReview: null,
  restoreArchivedReview: { repoPath, id: '' },
  deleteArchivedReview: { repoPath },
  addReviewComment: { repoPath, path: 'src/changed.ts', body: '' },
  editReviewComment: { repoPath, id: 'comment-synthetic', body: '' },
  deleteReviewComment: { repoPath, id: '' },
  clearResolvedReviewComments: { repoPath: '' },
  resolveReviewComment: { repoPath, id: 'comment-synthetic', resolved: 'true' },
}

describe('Review procedure contracts', () => {
  it('declares exactly the twenty-three canonical procedures in the documented order', () => {
    const names = Object.keys(reviewProcedures)
    expect(names).toEqual(Object.keys(expectedKinds))
    expect(new Set(names).size).toBe(23)
  })

  it('splits into twelve queries and eleven mutations, name by name', () => {
    const kinds = Object.entries(expectedKinds)
    expect(kinds.filter(([, kind]) => kind === 'query')).toHaveLength(12)
    expect(kinds.filter(([, kind]) => kind === 'mutation')).toHaveLength(11)
    for (const [name, kind] of kinds) {
      expect(reviewProcedures[name as ReviewProcedureName].kind).toBe(kind)
    }
  })

  it('resurrects no retired Review name and no unit-of-work vocabulary', () => {
    const names = Object.keys(reviewProcedures)
    for (const name of names) expect(name).not.toMatch(/feature/i)
    for (const retired of retiredNames) expect(names).not.toContain(retired)
  })

  it('exposes a parsable contract and the documented error list on every entry', () => {
    for (const name of Object.keys(reviewProcedures) as ReviewProcedureName[]) {
      const procedure = reviewProcedures[name]
      expect(typeof procedure.input.safeParse).toBe('function')
      expect(typeof procedure.output.safeParse).toBe('function')
      expect(Array.isArray(procedure.errors)).toBe(true)
      const expected = expectedCommentErrors[name as keyof typeof expectedCommentErrors]
      expect([...procedure.errors]).toEqual(expected === undefined ? [] : [...expected])
    }
  })

  for (const name of Object.keys(reviewProcedures) as ReviewProcedureName[]) {
    it(`accepts a valid ${name} input and output`, () => {
      const procedure = reviewProcedures[name]
      expect(procedure.input.safeParse(fixtures[name].input).success).toBe(true)
      expect(procedure.output.safeParse(fixtures[name].output).success).toBe(true)
    })

    it(`rejects an invalid ${name} input`, () => {
      expect(reviewProcedures[name].input.safeParse(invalidInputs[name]).success).toBe(false)
    })

    it(`accepts the published ${name} contract fixture`, () => {
      const fixture = reviewContractFixtures[name]
      const procedure = reviewProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })
  }

  it('keeps setReviewed total: a non-empty path list and a boolean state', () => {
    const input = reviewProcedures.setReviewed.input
    expect(input.safeParse({ repoPath, paths: ['src/changed.ts'], reviewed: false }).success).toBe(
      true,
    )
    expect(input.safeParse({ repoPath, paths: [], reviewed: true }).success).toBe(false)
    expect(input.safeParse({ repoPath, paths: ['src/changed.ts'], reviewed: 'yes' }).success).toBe(
      false,
    )
    expect(input.safeParse({ repoPath, paths: [42], reviewed: true }).success).toBe(false)
    expect(input.safeParse({ repoPath, paths: ['src/changed.ts'] }).success).toBe(false)
  })

  it('rejects blank comment ids before they can reach non-empty not-found error details', () => {
    expect(
      reviewProcedures.editReviewComment.input.safeParse({ repoPath, id: '', body: 'x' }).success,
    ).toBe(false)
    expect(reviewProcedures.deleteReviewComment.input.safeParse({ repoPath, id: '' }).success).toBe(
      false,
    )
    expect(
      reviewProcedures.resolveReviewComment.input.safeParse({ repoPath, id: '', resolved: true })
        .success,
    ).toBe(false)
    expect(
      reviewProcedures.restoreArchivedReview.input.safeParse({ repoPath, id: '' }).success,
    ).toBe(false)
  })

  it('preserves comment anchor bounds and the void mutation results', () => {
    const addInput = reviewProcedures.addReviewComment.input
    const valid = fixtures.addReviewComment.input as Record<string, unknown>
    expect(addInput.safeParse({ ...valid, startLine: 0 }).success).toBe(false)
    expect(addInput.safeParse({ ...valid, endLine: 1.5 }).success).toBe(false)

    for (const [name, procedure] of Object.entries(reviewProcedures)) {
      if (expectedKinds[name as keyof typeof expectedKinds] !== 'mutation') continue
      if (name === 'publishReview' || name === 'addReviewComment') continue
      expect(procedure.output.safeParse(undefined).success).toBe(true)
    }
  })
})

describe('Review staleness fact', () => {
  it('lists only Review queries and excludes the two independent reads', () => {
    for (const name of REVIEW_STALE_ON_REVIEW_CHANGED) {
      expect(Object.keys(reviewProcedures)).toContain(name)
      expect(reviewProcedures[name].kind).toBe('query')
    }
    expect(REVIEW_STALE_ON_REVIEW_CHANGED).toHaveLength(10)
    expect(new Set(REVIEW_STALE_ON_REVIEW_CHANGED).size).toBe(REVIEW_STALE_ON_REVIEW_CHANGED.length)
    expect(REVIEW_STALE_ON_REVIEW_CHANGED).not.toContain('reviewInbox')
    expect(REVIEW_STALE_ON_REVIEW_CHANGED).not.toContain('exploreReading')
  })

  it('adds no second Review notification kind', () => {
    expect(REVIEW_CHANGE_KINDS).toHaveLength(1)
    expect(reviewChangeSchema.safeParse(reviewNotificationFixtures['review.changed']).success).toBe(
      true,
    )
  })
})

describe('Live catalog activation', () => {
  it('serves every canonical Review name and no retired name', () => {
    const liveNames = Object.keys(procedureCatalog)
    for (const name of Object.keys(reviewProcedures)) expect(liveNames).toContain(name)
    for (const name of retiredNames) expect(liveNames).not.toContain(name)
  })
})

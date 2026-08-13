import { describe, expect, it } from 'vitest'
import { procedureCatalog } from '../procedure-catalog'
import {
  REVIEW_CHANGE_KINDS,
  reviewChangeSchema,
  reviewNotificationFixtures,
} from './review.notifications'
import {
  targetActiveReviewOutputSchema,
  targetEvidenceAssetDescriptorSchema,
  targetEvidenceDocDescriptorSchema,
  targetReviewEvidenceOutputSchema,
  targetReviewEvidenceSchema,
  targetReviewReadingSchema,
} from './review.target-contract'
import {
  REVIEW_TARGET_STALE_ON_REVIEW_CHANGED,
  type ReviewTargetProcedureName,
  reviewTargetProcedures,
} from './review.target-procedures'

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

/** The documented target order: twelve queries, then eleven mutations. */
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

/** Names the target vocabulary must never resurrect. */
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
  'completeReview',
]

/** Target names that already exist on the live wire under the same name. */
const targetNamesAlreadyLive = [
  'reviewedPaths',
  'reviewIntent',
  'reviewEvidenceAsset',
  'archivedReviews',
  'reviewComments',
  'setReviewed',
  'publishReview',
  'restoreArchivedReview',
  'deleteArchivedReview',
  'addReviewComment',
  'editReviewComment',
  'deleteReviewComment',
  'clearResolvedReviewComments',
  'resolveReviewComment',
]

/** Target names that must be absent from the live catalog until REV-009 activates them. */
const targetNamesNotYetLive = [
  'reviewInbox',
  'activeReview',
  'reviewReading',
  'exploreReading',
  'reviewEvidence',
  'reviewEvidenceDoc',
  'publishCost',
  'archiveReview',
  'clearEvidence',
]

type Fixture = { input: unknown; output: unknown }

const fixtures: Record<ReviewTargetProcedureName, Fixture> = {
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

const invalidInputs: Record<ReviewTargetProcedureName, unknown> = {
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

describe('Review target procedure contracts', () => {
  it('declares exactly the twenty-three target procedures in the documented order', () => {
    const names = Object.keys(reviewTargetProcedures)
    expect(names).toEqual(Object.keys(expectedKinds))
    expect(new Set(names).size).toBe(23)
  })

  it('splits into twelve queries and eleven mutations, name by name', () => {
    const kinds = Object.entries(expectedKinds)
    expect(kinds.filter(([, kind]) => kind === 'query')).toHaveLength(12)
    expect(kinds.filter(([, kind]) => kind === 'mutation')).toHaveLength(11)
    for (const [name, kind] of kinds) {
      expect(reviewTargetProcedures[name as ReviewTargetProcedureName].kind).toBe(kind)
    }
  })

  it('resurrects no retired Review name and no unit-of-work vocabulary', () => {
    const names = Object.keys(reviewTargetProcedures)
    for (const name of names) expect(name).not.toMatch(/feature/i)
    for (const retired of retiredNames) expect(names).not.toContain(retired)
  })

  it('exposes a parsable contract and the copied error list on every entry', () => {
    for (const name of Object.keys(reviewTargetProcedures) as ReviewTargetProcedureName[]) {
      const procedure = reviewTargetProcedures[name]
      expect(typeof procedure.input.safeParse).toBe('function')
      expect(typeof procedure.output.safeParse).toBe('function')
      expect(Array.isArray(procedure.errors)).toBe(true)
      const expected = expectedCommentErrors[name as keyof typeof expectedCommentErrors]
      expect([...procedure.errors]).toEqual(expected === undefined ? [] : [...expected])
    }
  })

  for (const name of Object.keys(reviewTargetProcedures) as ReviewTargetProcedureName[]) {
    it(`accepts a valid ${name} input and output`, () => {
      const procedure = reviewTargetProcedures[name]
      expect(procedure.input.safeParse(fixtures[name].input).success).toBe(true)
      expect(procedure.output.safeParse(fixtures[name].output).success).toBe(true)
    })

    it(`rejects an invalid ${name} input`, () => {
      expect(reviewTargetProcedures[name].input.safeParse(invalidInputs[name]).success).toBe(false)
    })
  }

  it('keeps setReviewed total: a non-empty path list and a boolean state', () => {
    const input = reviewTargetProcedures.setReviewed.input
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
})

describe('Target Evidence aggregate', () => {
  it('rejects the retired markers and any inline body', () => {
    for (const extra of [{ medium: 'html' }, { hasReport: true }, { dir: '/abs/evidence' }]) {
      expect(targetReviewEvidenceSchema.safeParse({ ...evidence, ...extra }).success).toBe(false)
    }
    expect(
      targetReviewEvidenceSchema.safeParse({
        ...evidence,
        results: [{ ...docDescriptor, body: '# Results' }],
      }).success,
    ).toBe(false)
    expect(
      targetReviewEvidenceSchema.safeParse({
        ...evidence,
        assets: [{ ...assetDescriptor, dataUrl: 'data:image/png;base64,AA==' }],
      }).success,
    ).toBe(false)
  })

  it('round-trips both descriptor states and requires the unavailable reason', () => {
    expect(targetEvidenceDocDescriptorSchema.safeParse(docDescriptor).success).toBe(true)
    expect(targetEvidenceDocDescriptorSchema.safeParse(docDescriptorUnavailable).success).toBe(true)
    expect(targetEvidenceAssetDescriptorSchema.safeParse(assetDescriptor).success).toBe(true)
    expect(targetEvidenceAssetDescriptorSchema.safeParse(assetDescriptorUnavailable).success).toBe(
      true,
    )

    const { reason: _reason, ...withoutReason } = docDescriptorUnavailable
    expect(targetEvidenceDocDescriptorSchema.safeParse(withoutReason).success).toBe(false)
    const { maxBytes: _maxBytes, ...withoutMax } = assetDescriptorUnavailable
    expect(targetEvidenceAssetDescriptorSchema.safeParse(withoutMax).success).toBe(false)
    expect(
      targetEvidenceDocDescriptorSchema.safeParse({
        ...docDescriptorUnavailable,
        reason: 'missing',
      }).success,
    ).toBe(false)
  })

  it('rejects an uncontained descriptor file name', () => {
    for (const file of ['../escape.png', 'a/b.png', '.hidden.png', 'a\\b.png', '']) {
      expect(
        targetEvidenceAssetDescriptorSchema.safeParse({ ...assetDescriptor, file }).success,
      ).toBe(false)
      expect(targetEvidenceDocDescriptorSchema.safeParse({ ...docDescriptor, file }).success).toBe(
        false,
      )
    }
  })

  it('separates the absent pack from a checks-only pack', () => {
    expect(targetReviewEvidenceOutputSchema.safeParse(null).success).toBe(true)
    expect(
      targetReviewEvidenceOutputSchema.safeParse({
        title: 'Evidence',
        updatedAt,
        checks: [check],
        results: [],
        assets: [],
      }).success,
    ).toBe(true)
  })
})

describe('Target reading and active review', () => {
  it('drops the scene canvas and the evidence medium marker', () => {
    expect(targetReviewReadingSchema.safeParse(reading).success).toBe(true)
    expect(
      targetReviewReadingSchema.safeParse({
        ...reading,
        canvas: { medium: 'html', html: '<p>x</p>' },
      }).success,
    ).toBe(false)
    expect(
      targetReviewReadingSchema.safeParse({
        ...reading,
        evidence: { ...reading.evidence, medium: 'html' },
      }).success,
    ).toBe(false)
  })

  it('keeps the empty review distinct from no review', () => {
    expect(targetActiveReviewOutputSchema.safeParse(null).success).toBe(true)
    expect(
      targetActiveReviewOutputSchema.safeParse({
        name: '',
        fromAgent: false,
        sections: [],
        groups: [],
      }).success,
    ).toBe(true)
  })
})

describe('Target staleness fact', () => {
  it('lists only target queries and excludes the two independent reads', () => {
    for (const name of REVIEW_TARGET_STALE_ON_REVIEW_CHANGED) {
      expect(Object.keys(reviewTargetProcedures)).toContain(name)
      expect(reviewTargetProcedures[name].kind).toBe('query')
    }
    expect(new Set(REVIEW_TARGET_STALE_ON_REVIEW_CHANGED).size).toBe(
      REVIEW_TARGET_STALE_ON_REVIEW_CHANGED.length,
    )
    expect(REVIEW_TARGET_STALE_ON_REVIEW_CHANGED).not.toContain('reviewInbox')
    expect(REVIEW_TARGET_STALE_ON_REVIEW_CHANGED).not.toContain('exploreReading')
  })

  it('adds no second Review notification kind', () => {
    expect(REVIEW_CHANGE_KINDS).toHaveLength(1)
    expect(reviewChangeSchema.safeParse(reviewNotificationFixtures['review.changed']).success).toBe(
      true,
    )
  })
})

describe('Live catalog isolation', () => {
  it('leaves the 113-name wire untouched and activates no target name', () => {
    const liveNames = Object.keys(procedureCatalog)
    expect(liveNames).toHaveLength(113)
    for (const name of targetNamesAlreadyLive) expect(liveNames).toContain(name)
    for (const name of targetNamesNotYetLive) expect(liveNames).not.toContain(name)
    expect([...targetNamesAlreadyLive, ...targetNamesNotYetLive].sort()).toEqual(
      Object.keys(reviewTargetProcedures).sort(),
    )
  })
})

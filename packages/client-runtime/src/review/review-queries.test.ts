import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'
import {
  type ReviewExploreSeed,
  ReviewIdentityError,
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewProjectKey,
  reviewPublishCostQuery,
  reviewQuerySchema,
  reviewReadingQuery,
  reviewViewQuery,
  worktreeInboxQuery,
} from './review-queries'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'
const FILE_SEED: ReviewExploreSeed = { kind: 'file', path: 'src/changed.ts' }
const SYMBOL_SEED: ReviewExploreSeed = {
  kind: 'symbol',
  path: 'src/changed.ts',
  symbol: 'value',
}

describe('reviewProjectKey', () => {
  it('returns the non-empty project path unchanged', () => {
    expect(reviewProjectKey(PROJECT)).toBe(PROJECT)
    expect(reviewProjectKey('/synthetic/repo/')).toBe('/synthetic/repo/')
  })

  it('throws ReviewIdentityError for an empty path', () => {
    expect(() => reviewProjectKey('')).toThrow(ReviewIdentityError)
    expect(() => reviewProjectKey('')).toThrow('review: project path must be non-empty')
  })
})

describe('Review query identities', () => {
  it('gives every identity its exact object shape', () => {
    expect(reviewViewQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'view',
      projectPath: PROJECT,
    })
    expect(reviewReadingQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'reading',
      projectPath: PROJECT,
    })
    expect(reviewIntentQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'intent',
      projectPath: PROJECT,
    })
    expect(reviewEvidenceQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'evidence',
      projectPath: PROJECT,
    })
    expect(reviewEvidenceHtmlQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'evidence-html',
      projectPath: PROJECT,
    })
    expect(reviewEvidenceDocsQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'evidence-docs',
      projectPath: PROJECT,
    })
    expect(reviewEvidenceAssetsQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'evidence-assets',
      projectPath: PROJECT,
    })
    expect(reviewPublishCostQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'publish-cost',
      projectPath: PROJECT,
    })
    expect(reviewArchivedQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'archived',
      projectPath: PROJECT,
    })
  })

  it('carries the extra dimension of the asset and explore identities', () => {
    expect(reviewEvidenceAssetQuery(PROJECT, 'shot.png')).toEqual({
      domain: 'review',
      name: 'evidence-asset',
      projectPath: PROJECT,
      file: 'shot.png',
    })
    expect(reviewExploreQuery(PROJECT, SYMBOL_SEED)).toEqual({
      domain: 'review',
      name: 'explore',
      projectPath: PROJECT,
      seed: SYMBOL_SEED,
    })
  })

  it('keeps the four relocated identities byte-identical to the Git slice objects', () => {
    expect(reviewReadingQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'reading',
      projectPath: PROJECT,
    })
    expect(reviewViewQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'view',
      projectPath: PROJECT,
    })
    expect(reviewedPathsQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'reviewed-paths',
      projectPath: PROJECT,
    })
    expect(worktreeInboxQuery(PROJECT)).toEqual({
      domain: 'review',
      name: 'worktree-inbox',
      projectPath: PROJECT,
    })
  })

  it('keeps identities distinct by project, asset file, and explore seed', () => {
    expect(reviewViewQuery(PROJECT)).not.toEqual(reviewViewQuery(OTHER_PROJECT))
    expect(reviewedPathsQuery(PROJECT)).not.toEqual(reviewedPathsQuery(OTHER_PROJECT))
    expect(reviewEvidenceAssetQuery(PROJECT, 'shot.png')).not.toEqual(
      reviewEvidenceAssetQuery(PROJECT, 'other.png'),
    )
    expect(reviewEvidenceAssetQuery(PROJECT, 'shot.png')).not.toEqual(
      reviewEvidenceAssetQuery(OTHER_PROJECT, 'shot.png'),
    )
    expect(reviewExploreQuery(PROJECT, FILE_SEED)).not.toEqual(
      reviewExploreQuery(PROJECT, SYMBOL_SEED),
    )
    expect(reviewViewQuery(PROJECT)).not.toEqual(reviewReadingQuery(PROJECT))
    expect(reviewEvidenceQuery(PROJECT)).not.toEqual(reviewEvidenceHtmlQuery(PROJECT))
  })

  it('throws ReviewIdentityError from every constructor for an empty project path', () => {
    const constructors = [
      (): unknown => reviewViewQuery(''),
      (): unknown => reviewReadingQuery(''),
      (): unknown => reviewIntentQuery(''),
      (): unknown => reviewEvidenceQuery(''),
      (): unknown => reviewEvidenceHtmlQuery(''),
      (): unknown => reviewEvidenceDocsQuery(''),
      (): unknown => reviewEvidenceAssetsQuery(''),
      (): unknown => reviewEvidenceAssetQuery('', 'shot.png'),
      (): unknown => reviewPublishCostQuery(''),
      (): unknown => reviewArchivedQuery(''),
      (): unknown => reviewedPathsQuery(''),
      (): unknown => worktreeInboxQuery(''),
      (): unknown => reviewExploreQuery('', FILE_SEED),
    ]
    expect(constructors).toHaveLength(13)
    for (const construct of constructors) {
      expect(construct).toThrow(ReviewIdentityError)
    }
  })
})

describe('reviewQuerySchema', () => {
  it('parses every constructor output and the comments identity', () => {
    const queries = [
      reviewViewQuery(PROJECT),
      reviewReadingQuery(PROJECT),
      reviewIntentQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewEvidenceHtmlQuery(PROJECT),
      reviewEvidenceDocsQuery(PROJECT),
      reviewEvidenceAssetsQuery(PROJECT),
      reviewEvidenceAssetQuery(PROJECT, 'shot.png'),
      reviewPublishCostQuery(PROJECT),
      reviewArchivedQuery(PROJECT),
      reviewedPathsQuery(PROJECT),
      worktreeInboxQuery(PROJECT),
      reviewExploreQuery(PROJECT, FILE_SEED),
      reviewCommentsQuery(PROJECT),
    ]
    expect(queries).toHaveLength(14)
    for (const query of queries) {
      expect(reviewQuerySchema.safeParse(query).success).toBe(true)
    }
  })

  it('rejects an unknown name, an unknown extra key, and a missing dimension', () => {
    expect(
      reviewQuerySchema.safeParse({ domain: 'review', name: 'activeReview', projectPath: PROJECT })
        .success,
    ).toBe(false)
    expect(
      reviewQuerySchema.safeParse({
        domain: 'review',
        name: 'view',
        projectPath: PROJECT,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      reviewQuerySchema.safeParse({
        domain: 'review',
        name: 'evidence-asset',
        projectPath: PROJECT,
      }).success,
    ).toBe(false)
    expect(
      reviewQuerySchema.safeParse({ domain: 'review', name: 'explore', projectPath: PROJECT })
        .success,
    ).toBe(false)
    expect(
      reviewQuerySchema.safeParse({ domain: 'review', name: 'view', projectPath: '' }).success,
    ).toBe(false)
    expect(
      reviewQuerySchema.safeParse({ domain: 'git', name: 'view', projectPath: PROJECT }).success,
    ).toBe(false)
  })
})

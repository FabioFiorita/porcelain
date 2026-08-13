import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { gitHeadQuery } from '@porcelain/client-runtime/git'
import {
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetQueryFamily,
  reviewEvidenceDocsQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

/**
 * The subject is the Review key filter and ruling 5's forward into the Changes-owned
 * reviewed-marks entry. `features/changes/use-changes` reaches the Git and Remote features for
 * the flow reads this test never renders; stubbing those two keeps the module graph off the
 * native runtime without faking anything the assertions depend on — `daemonKeys` stays real.
 */
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: undefined, isLoading: false }),
  useGitRangeFlow: () => ({ base: undefined, error: null, groups: undefined, isLoading: false }),
}))
vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => null,
  environmentActions: {
    recordReachabilitySuccess: (): void => {},
    recordReachabilityFailure: (): void => {},
  },
}))

import {
  invalidateAllReviewQueries,
  invalidateReviewEffects,
  invalidateReviewProject,
  reviewQueryMatchesEffect,
} from './review-query-filter'
import { reviewQueryKey } from './review-query-key'

const ENVIRONMENT = 'env-review-test'
const OTHER_ENVIRONMENT = 'env-other'
const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other'

/** The Changes-owned procedure-name entry the `reviewed-paths` effect must still reach. */
function reviewedPathsCacheKey(environmentId: string): readonly unknown[] {
  return ['daemon', environmentId, 'reviewedPaths', PROJECT]
}

describe('Mobile Review effect matching', () => {
  it('matches an exact effect only against the identical identity and environment', () => {
    const key = reviewQueryKey(ENVIRONMENT, reviewEvidenceAssetQuery(PROJECT, 'shot.png'))

    expect(
      reviewQueryMatchesEffect(key, reviewEvidenceAssetQuery(PROJECT, 'shot.png'), ENVIRONMENT),
    ).toBe(true)
    expect(
      reviewQueryMatchesEffect(key, reviewEvidenceAssetQuery(PROJECT, 'other.png'), ENVIRONMENT),
    ).toBe(false)
    expect(
      reviewQueryMatchesEffect(
        key,
        reviewEvidenceAssetQuery(OTHER_PROJECT, 'shot.png'),
        ENVIRONMENT,
      ),
    ).toBe(false)
    expect(
      reviewQueryMatchesEffect(
        key,
        reviewEvidenceAssetQuery(PROJECT, 'shot.png'),
        OTHER_ENVIRONMENT,
      ),
    ).toBe(false)
  })
})

describe('Mobile Review effect invalidation', () => {
  it('reaches every asset key of a project through the family and no other project', async () => {
    const queryClient = new QueryClient()
    const shot = reviewQueryKey(ENVIRONMENT, reviewEvidenceAssetQuery(PROJECT, 'shot.png'))
    const trace = reviewQueryKey(ENVIRONMENT, reviewEvidenceAssetQuery(PROJECT, 'trace.png'))
    const other = reviewQueryKey(ENVIRONMENT, reviewEvidenceAssetQuery(OTHER_PROJECT, 'shot.png'))
    const docs = reviewQueryKey(ENVIRONMENT, reviewEvidenceDocsQuery(PROJECT))
    for (const key of [shot, trace, other, docs]) queryClient.setQueryData(key, {})

    await invalidateReviewEffects(queryClient, ENVIRONMENT, [
      reviewEvidenceAssetQueryFamily(PROJECT),
    ])

    expect(queryClient.getQueryState(shot)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(trace)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(docs)?.isInvalidated).toBeFalsy()
  })

  it('invalidates only the identical identity for an exact effect', async () => {
    const queryClient = new QueryClient()
    const reading = reviewQueryKey(ENVIRONMENT, reviewReadingQuery(PROJECT))
    const archived = reviewQueryKey(ENVIRONMENT, reviewArchivedQuery(PROJECT))
    const foreign = reviewQueryKey(OTHER_ENVIRONMENT, reviewReadingQuery(PROJECT))
    for (const key of [reading, archived, foreign]) queryClient.setQueryData(key, {})

    await invalidateReviewEffects(queryClient, ENVIRONMENT, [reviewReadingQuery(PROJECT)])

    expect(queryClient.getQueryState(reading)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(archived)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()
  })

  it('forwards a reviewed-paths effect to the Changes cache entry and no Review key', async () => {
    const queryClient = new QueryClient()
    const reviewedPaths = reviewedPathsCacheKey(ENVIRONMENT)
    const foreignReviewedPaths = reviewedPathsCacheKey(OTHER_ENVIRONMENT)
    const reading = reviewQueryKey(ENVIRONMENT, reviewReadingQuery(PROJECT))
    // The typed reviewed-paths identity has no mobile cache entry — Changes owns the ticks.
    const typedIdentity = reviewQueryKey(ENVIRONMENT, reviewedPathsQuery(PROJECT))
    for (const key of [reviewedPaths, foreignReviewedPaths, reading, typedIdentity]) {
      queryClient.setQueryData(key, {})
    }

    await invalidateReviewEffects(queryClient, ENVIRONMENT, [reviewedPathsQuery(PROJECT)])

    expect(queryClient.getQueryState(reviewedPaths)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(foreignReviewedPaths)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(reading)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(typedIdentity)?.isInvalidated).toBeFalsy()
  })

  it('invalidates a duplicated effect list once', async () => {
    const queryClient = new QueryClient()
    const reading = reviewQueryKey(ENVIRONMENT, reviewReadingQuery(PROJECT))
    queryClient.setQueryData(reading, {})
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await invalidateReviewEffects(queryClient, ENVIRONMENT, [
      reviewReadingQuery(PROJECT),
      reviewReadingQuery(PROJECT),
      reviewArchivedQuery(PROJECT),
    ])

    expect(invalidate).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryState(reading)?.isInvalidated).toBe(true)
  })

  it('recovers every Review identity of a session, and one project alone', async () => {
    const queryClient = new QueryClient()
    const reading = reviewQueryKey(ENVIRONMENT, reviewReadingQuery(PROJECT))
    const archived = reviewQueryKey(ENVIRONMENT, reviewArchivedQuery(PROJECT))
    const other = reviewQueryKey(ENVIRONMENT, reviewReadingQuery(OTHER_PROJECT))
    const foreign = reviewQueryKey(OTHER_ENVIRONMENT, reviewReadingQuery(PROJECT))
    const git = ['daemon', ENVIRONMENT, gitHeadQuery(PROJECT)] as const
    const board = ['daemon', ENVIRONMENT, boardCardsQuery(PROJECT)] as const
    for (const key of [reading, archived, other, foreign, git, board]) {
      queryClient.setQueryData(key, {})
    }

    await invalidateReviewProject(queryClient, ENVIRONMENT, PROJECT)
    expect(queryClient.getQueryState(reading)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(archived)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()

    await invalidateAllReviewQueries(queryClient, ENVIRONMENT)
    expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(foreign)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(git)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(board)?.isInvalidated).toBeFalsy()
  })
})

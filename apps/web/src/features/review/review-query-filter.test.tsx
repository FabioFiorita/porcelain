import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { gitStatusQuery } from '@porcelain/client-runtime/git'
import {
  reviewActiveQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetQueryFamily,
  reviewedPathsQuery,
  reviewIntentQuery,
} from '@porcelain/client-runtime/review'
import { gitQueryKey } from '@renderer/features/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateAllReviewQueries, invalidateReviewEffects } from './review-query-filter'
import { reviewQueryKey } from './review-query-key'

const DAEMON: DaemonScope = { host: '127.0.0.1:43118', version: '0.0.0-test' }
const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'

/** Seed a cache entry and report whether a later invalidation marked it stale. */
function seed(client: QueryClient, key: readonly unknown[]): () => boolean {
  client.setQueryData(key, 'seeded')
  return () => client.getQueryState(key)?.isInvalidated === true
}

describe('invalidateReviewEffects', () => {
  it('reaches every asset key of one project for a family effect and no other project', async () => {
    const client = new QueryClient()
    const mine = seed(client, reviewQueryKey(DAEMON, reviewEvidenceAssetQuery(PROJECT, 'a.png')))
    const alsoMine = seed(
      client,
      reviewQueryKey(DAEMON, reviewEvidenceAssetQuery(PROJECT, 'b.png')),
    )
    const theirs = seed(client, reviewQueryKey(DAEMON, reviewEvidenceAssetQuery(OTHER, 'a.png')))
    const listing = seed(client, reviewQueryKey(DAEMON, reviewEvidenceAssetQueryFamily(PROJECT)))

    await invalidateReviewEffects(client, DAEMON, [reviewEvidenceAssetQueryFamily(PROJECT)])

    expect(mine()).toBe(true)
    expect(alsoMine()).toBe(true)
    expect(theirs()).toBe(false)
    expect(listing()).toBe(false)
  })

  it('invalidates only its own key for an exact identity effect', async () => {
    const client = new QueryClient()
    const intent = seed(client, reviewQueryKey(DAEMON, reviewIntentQuery(PROJECT)))
    const view = seed(client, reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT)))

    await invalidateReviewEffects(client, DAEMON, [reviewIntentQuery(PROJECT)])

    expect(intent()).toBe(true)
    expect(view()).toBe(false)
  })

  it('forwards a reviewed-paths effect to the Git-keyed cache and leaves Review keys alone', async () => {
    const client = new QueryClient()
    const gitKeyed = seed(client, gitQueryKey(DAEMON, reviewedPathsQuery(PROJECT)))
    const view = seed(client, reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT)))

    await invalidateReviewEffects(client, DAEMON, [reviewedPathsQuery(PROJECT)])

    expect(gitKeyed()).toBe(true)
    expect(view()).toBe(false)
  })

  it('invalidates each key once for a duplicated effect list', async () => {
    const client = new QueryClient()
    const key = reviewQueryKey(DAEMON, reviewIntentQuery(PROJECT))
    client.setQueryData(key, 'seeded')
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    await invalidateReviewEffects(client, DAEMON, [
      reviewIntentQuery(PROJECT),
      reviewIntentQuery(PROJECT),
      reviewIntentQuery(PROJECT),
    ])

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
})

describe('invalidateAllReviewQueries', () => {
  it('invalidates every Review key and nothing owned by another domain', async () => {
    const client = new QueryClient()
    const view = seed(client, reviewQueryKey(DAEMON, reviewActiveQuery(PROJECT)))
    const otherProject = seed(client, reviewQueryKey(DAEMON, reviewActiveQuery(OTHER)))
    const status = seed(client, gitQueryKey(DAEMON, gitStatusQuery(PROJECT)))
    const board = seed(client, [boardCardsQuery(PROJECT), DAEMON])

    await invalidateAllReviewQueries(client)

    expect(view()).toBe(true)
    expect(otherProject()).toBe(true)
    expect(status()).toBe(false)
    expect(board()).toBe(false)
  })
})

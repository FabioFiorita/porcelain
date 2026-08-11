import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { createValidatingTrpcHarness, deferred } from '@renderer/hooks/trpc-test-harness'
import { useRepoStore } from '@renderer/stores/repo'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useReviewComments } from './comment-queries'
import { reviewCommentsKeyForProject } from './comment-query-key'

const REPO = reviewContractFixtures.reviewComments.input
const OTHER = '/synthetic/other'

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
}

describe('useReviewComments', () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: { path: REPO, name: 'repo' } })
  })

  it('queries reviewComments for the active Project and exposes contract-valid comments', async () => {
    const comments = reviewContractFixtures.reviewComments.output
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      reviewComments: (input) => {
        expect(input).toBe(REPO)
        return { ok: true, value: comments }
      },
    })

    const { result } = renderHook(() => useReviewComments(), { wrapper })
    await waitFor(() => expect(result.current).toEqual(comments))

    expect(mock.requests().filter((r) => r.procedure === 'reviewComments')).toContainEqual({
      procedure: 'reviewComments',
      kind: 'query',
      input: REPO,
    })
  })

  it('returns an empty list when no Project is selected', () => {
    useRepoStore.setState({ repo: null })
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      reviewComments: () => ({ ok: true, value: [] }),
    })
    const { result } = renderHook(() => useReviewComments(), { wrapper })
    expect(result.current).toEqual([])
  })

  it('returns an empty list for a successful empty server response', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      reviewComments: () => ({ ok: true, value: [] }),
    })
    const { result } = renderHook(() => useReviewComments(), { wrapper })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('embeds the RVC-002 comments identity and daemon scope in the React Query key', () => {
    const key = reviewCommentsKeyForProject({ host: 'beelink', version: '0.52.1' }, REPO)
    expect(key[0]).toEqual({ domain: 'review', name: 'comments', projectPath: REPO })
    expect(key[1]).toEqual({ host: 'beelink', version: '0.52.1' })
    expect(
      reviewCommentsKeyForProject({ host: 'beelink', version: '0.52.1' }, OTHER)[0],
    ).not.toEqual(key[0])
  })

  it('keeps unloaded list indistinguishable as empty until settlement', async () => {
    const pending = deferred<typeof reviewContractFixtures.reviewComments.output>()
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      reviewComments: () => pending.promise.then((value) => ({ ok: true as const, value })),
    })
    const { result } = renderHook(() => useReviewComments(), { wrapper })
    expect(result.current).toEqual([])
    pending.resolve([])
    await waitFor(() => expect(result.current).toEqual([]))
  })
})

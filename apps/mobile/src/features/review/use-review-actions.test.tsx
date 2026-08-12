import { reviewContractFixtures } from '@porcelain/contracts/review'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isReviewCommentsQueryKey,
  reviewCommentsQueryKey,
} from '@/features/comments/comment-query-key'

import { useArchivedReviewActions, useReviewActions } from './use-review'

const REPO = reviewContractFixtures.publishReview.input
const ENV_ID = 'env-review-lifecycle'

const ctx = vi.hoisted(() => ({
  env: {
    id: 'env-review-lifecycle',
    nickname: 'test',
    icon: 'desktop' as const,
    baseUrl: 'http://127.0.0.1:43118',
    endpoints: ['http://127.0.0.1:43118'],
    preferredEndpoint: 'http://127.0.0.1:43118',
    createdAt: 1,
    activeRepoPath: '/synthetic/repo' as string | null,
    token: 'pc_client_test',
  },
  repoPath: '/synthetic/repo' as string | null,
  mutationHandlers: new Map<string, (input: unknown) => unknown>(),
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ baseUrl: 'http://127.0.0.1:43118', token: 'pc_client_test' }),
}))

vi.mock('@/features/projects', () => ({
  useActiveProject: () => (ctx.repoPath === null ? null : { path: ctx.repoPath, name: 'repo' }),
}))

vi.mock('@/features/comments', () => ({
  invalidateAllReviewComments: (queryClient: QueryClient, environmentId: string): Promise<void> =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return (
          Array.isArray(key) &&
          key[0] === 'daemon' &&
          key[1] === environmentId &&
          isReviewCommentsQueryKey(key)
        )
      },
    }),
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.env,
  environmentActions: {
    recordReachabilitySuccess: vi.fn(),
    recordReachabilityFailure: vi.fn(),
  },
}))

vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return {
    ...actual,
    callDaemon: async (
      _client: unknown,
      procedure: { name: string },
      input: unknown,
    ): Promise<unknown> => {
      const handler = ctx.mutationHandlers.get(procedure.name)
      if (handler === undefined) {
        throw new Error(`No test handler for ${procedure.name}`)
      }
      return handler(input)
    },
  }
})

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.repoPath = REPO
  ctx.env = {
    id: ENV_ID,
    nickname: 'test',
    icon: 'desktop',
    baseUrl: 'http://127.0.0.1:43118',
    endpoints: ['http://127.0.0.1:43118'],
    preferredEndpoint: 'http://127.0.0.1:43118',
    createdAt: 1,
    activeRepoPath: REPO,
    token: 'pc_client_test',
  }
  ctx.mutationHandlers.clear()
  ctx.mutationHandlers.set('publishReview', () => reviewContractFixtures.publishReview.output)
  ctx.mutationHandlers.set('clearFeatureReview', () => undefined)
  ctx.mutationHandlers.set('restoreArchivedReview', () => undefined)
  ctx.mutationHandlers.set('deleteArchivedReview', () => undefined)
  ctx.mutationHandlers.set('clearLoopEvidence', () => undefined)
})

describe('Review lifecycle typed comments invalidation (RVC-004)', () => {
  it('publish invalidates the typed comments cache for the active environment', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const commentsKey = reviewCommentsQueryKey(ENV_ID, REPO)
    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)

    const { result } = renderHook(() => useReviewActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.publish()
    })

    await waitFor(() => {
      expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBe(true)
    })
  })

  it('archive invalidates the typed comments cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const commentsKey = reviewCommentsQueryKey(ENV_ID, REPO)
    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)

    const { result } = renderHook(() => useReviewActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.archive()
    })

    await waitFor(() => {
      expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBe(true)
    })
  })

  it('archived restore and remove invalidate the typed comments cache', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const commentsKey = reviewCommentsQueryKey(ENV_ID, REPO)
    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)

    const { result } = renderHook(() => useArchivedReviewActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.restore('archive-synthetic')
    })
    await waitFor(() => {
      expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBe(true)
    })

    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)
    // Reset invalidation so the second write can prove itself.
    queryClient.getQueryCache().find({ queryKey: commentsKey })?.setState({ isInvalidated: false })

    await act(async () => {
      await result.current.remove('archive-synthetic')
    })
    await waitFor(() => {
      expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBe(true)
    })
  })

  it('does not retain a reviewComments procedure-string invalidation path', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(__dirname, 'use-review.ts'), 'utf8')
    expect(source).not.toMatch(/['"]reviewComments['"]/)
    expect(source).toContain('invalidateAllReviewComments')
  })

  it('failed publish/archive leave typed comments caches uninvalidated', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const commentsKey = reviewCommentsQueryKey(ENV_ID, REPO)
    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)

    ctx.mutationHandlers.set('publishReview', () => {
      throw new Error('publish failed')
    })
    ctx.mutationHandlers.set('clearFeatureReview', () => {
      throw new Error('archive failed')
    })

    const { result } = renderHook(() => useReviewActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.publish()).rejects.toThrow('publish failed')
    })
    expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBeFalsy()

    await act(async () => {
      await expect(result.current.archive()).rejects.toThrow('archive failed')
    })
    expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBeFalsy()
  })

  it('failed archived restore/remove leave typed comments caches uninvalidated', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const commentsKey = reviewCommentsQueryKey(ENV_ID, REPO)
    queryClient.setQueryData(commentsKey, reviewContractFixtures.reviewComments.output)

    ctx.mutationHandlers.set('restoreArchivedReview', () => {
      throw new Error('restore failed')
    })
    ctx.mutationHandlers.set('deleteArchivedReview', () => {
      throw new Error('remove failed')
    })

    const { result } = renderHook(() => useArchivedReviewActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await expect(result.current.restore('archive-synthetic')).rejects.toThrow('restore failed')
    })
    expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBeFalsy()

    await act(async () => {
      await expect(result.current.remove('archive-synthetic')).rejects.toThrow('remove failed')
    })
    expect(queryClient.getQueryState(commentsKey)?.isInvalidated).toBeFalsy()
  })
})

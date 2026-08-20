import type { ReviewComment } from '@porcelain/contracts/review'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const REPO_PATH = '/synthetic/projects/alpha'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-review-test', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  repoPath: '/synthetic/projects/alpha' as string | null,
}))

vi.mock('@/features/remote', () => ({
  activeProjectPathOf: () => ctx.repoPath,
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useHubRepoPath: () => ctx.repoPath,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ mutation: vi.fn(), query: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useCommentActions, useReviewComments } from './comment-data'

const COMMENT: ReviewComment = {
  body: 'This branch never runs.',
  createdAt: 1_700_000_000_000,
  id: 'c1',
  path: 'src/a.ts',
  resolved: false,
  startLine: 12,
}

function dispatch(handlers: Record<string, (input: unknown) => unknown>) {
  return (_client: unknown, procedure: { readonly name: string }, input: unknown) => {
    const handler = handlers[procedure.name]
    if (handler === undefined) {
      return Promise.reject(new Error(`unexpected procedure ${procedure.name}`))
    }
    return Promise.resolve(handler(input))
  }
}

function wrapper(): (props: { children: ReactNode }) => React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }): React.JSX.Element {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.callDaemon.mockReset()
  ctx.environment = { id: 'env-review-test', token: 'paired' }
  ctx.repoPath = REPO_PATH
})

describe('useReviewComments', () => {
  it('reads the selected checkout, which the wire takes as a bare path', async () => {
    ctx.callDaemon.mockImplementation(dispatch({ reviewComments: () => [COMMENT] }))
    const { result } = renderHook(() => useReviewComments(true), { wrapper: wrapper() })

    await waitFor(() => {
      expect(result.current).toEqual([COMMENT])
    })
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'reviewComments' }),
      REPO_PATH,
    )
  })

  it('gates transport on pairing', () => {
    ctx.environment = { id: 'env-review-test', token: null }
    ctx.callDaemon.mockImplementation(dispatch({ reviewComments: () => [COMMENT] }))
    renderHook(() => useReviewComments(true), { wrapper: wrapper() })

    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })

  it('reads nothing while the surface is off screen', () => {
    ctx.callDaemon.mockImplementation(dispatch({ reviewComments: () => [COMMENT] }))
    const { result } = renderHook(() => useReviewComments(false), { wrapper: wrapper() })

    expect(result.current).toEqual([])
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

describe('useCommentActions', () => {
  it('replies by adding a comment on the anchor it was given', async () => {
    ctx.callDaemon.mockImplementation(dispatch({ addReviewComment: () => COMMENT }))
    const { result } = renderHook(() => useCommentActions(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.add({ body: 'Fix this', endLine: 14, path: 'src/a.ts', startLine: 12 })
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'addReviewComment' }),
      { body: 'Fix this', endLine: 14, path: 'src/a.ts', repoPath: REPO_PATH, startLine: 12 },
    )
  })

  it('omits an absent anchor rather than sending it, since the schema is strict', async () => {
    ctx.callDaemon.mockImplementation(dispatch({ addReviewComment: () => COMMENT }))
    const { result } = renderHook(() => useCommentActions(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.add({ body: 'On the whole file', path: 'src/a.ts' })
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'addReviewComment' }),
      { body: 'On the whole file', path: 'src/a.ts', repoPath: REPO_PATH },
    )
  })

  it('resolves and reopens through the one procedure that carries the flag', async () => {
    ctx.callDaemon.mockImplementation(dispatch({ resolveReviewComment: () => undefined }))
    const { result } = renderHook(() => useCommentActions(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.setResolved('c1', true)
    })
    await act(async () => {
      await result.current.setResolved('c1', false)
    })

    expect(ctx.callDaemon).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({ name: 'resolveReviewComment' }),
      { id: 'c1', repoPath: REPO_PATH, resolved: true },
    )
    expect(ctx.callDaemon).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ name: 'resolveReviewComment' }),
      { id: 'c1', repoPath: REPO_PATH, resolved: false },
    )
  })

  it('deletes and clears resolved by id and by checkout', async () => {
    ctx.callDaemon.mockImplementation(
      dispatch({
        clearResolvedReviewComments: () => undefined,
        deleteReviewComment: () => undefined,
      }),
    )
    const { result } = renderHook(() => useCommentActions(), { wrapper: wrapper() })

    await act(async () => {
      await result.current.remove('c1')
    })
    await act(async () => {
      await result.current.clearResolved()
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'deleteReviewComment' }),
      { id: 'c1', repoPath: REPO_PATH },
    )
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'clearResolvedReviewComments' }),
      { repoPath: REPO_PATH },
    )
  })

  it('refuses to write when no daemon is paired', async () => {
    ctx.environment = { id: 'env-review-test', token: null }
    ctx.callDaemon.mockImplementation(dispatch({ addReviewComment: () => COMMENT }))
    const { result } = renderHook(() => useCommentActions(), { wrapper: wrapper() })

    await expect(
      act(async () => {
        await result.current.add({ body: 'Fix this', path: 'src/a.ts' })
      }),
    ).rejects.toThrow('No daemon is paired.')
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

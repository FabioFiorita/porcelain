import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { gitContractFixtures } from '@porcelain/contracts/git'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  client: { mutation: vi.fn(), query: vi.fn() },
  environment: { id: 'env-git-test', token: 'paired' as string | null },
  project: { name: 'repo', path: '/synthetic/repo' },
}))

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

type TestClient = {
  mutation: (procedure: string, input: unknown) => Promise<unknown>
  query: (procedure: string, input: unknown) => Promise<unknown>
}

function clientFromMock(mock: ReturnType<typeof createValidatingDaemonMock>): TestClient {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (outcome.ok) return outcome.value
    const porcelain = outcome.error
    const message =
      porcelain !== null && typeof porcelain === 'object' && 'message' in porcelain
        ? String(porcelain.message)
        : 'daemon mock failure'
    throw TRPCClientError.from(
      Object.assign(new Error(message), {
        data: {
          code: 'INTERNAL_SERVER_ERROR',
          httpStatus: 500,
          porcelain,
        },
      }),
    )
  }
  return {
    mutation: vi.fn((procedure, input) => dispatch('mutation', procedure, input)),
    query: vi.fn((procedure, input) => dispatch('query', procedure, input)),
  }
}

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  environmentActions: {
    recordReachabilityFailure: vi.fn(),
    recordReachabilitySuccess: vi.fn(),
  },
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
  useHubRepoPath: () => ctx.project?.path ?? null,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ctx.client,
}))

import { useGitAddWorktree, useGitCheckout } from './git-mutations'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-git-test', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
  ctx.client = { mutation: vi.fn(), query: vi.fn() }
})

describe('Mobile Git workspace mutations', () => {
  it('uses the canonical mutation input and exact add-worktree effects', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitAddWorktree: () => ({ ok: true, value: gitContractFixtures.gitAddWorktree.output }),
    })
    ctx.client = clientFromMock(mock) as typeof ctx.client
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGitAddWorktree(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.mutateAsync('topic/synthetic')
    })

    expect(mock.requests()).toContainEqual({
      kind: 'mutation',
      procedure: 'gitAddWorktree',
      input: {
        branch: 'topic/synthetic',
        repoPath: ctx.project.path,
      },
    })
    // Two typed effects, one predicate pass each — no legacy procedure-key bridge left.
    expect(invalidate).toHaveBeenCalledTimes(2)
  })

  it('stays pending without invalidating, then rejects without post-failure effects', async () => {
    const write = Promise.withResolvers<DaemonMockOutcome>()
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitCheckout: async () => write.promise,
    })
    ctx.client = clientFromMock(mock) as typeof ctx.client
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useGitCheckout(), { wrapper: wrapper(queryClient) })

    let pending!: Promise<unknown>
    act(() => {
      pending = result.current.mutateAsync('topic/synthetic')
    })
    await waitFor(() => expect(result.current.isPending).toBe(true))
    expect(invalidate).not.toHaveBeenCalled()

    write.resolve({
      ok: false,
      error: {
        category: 'conflict',
        code: 'git.working-tree-conflict',
        message: 'dirty working tree',
        requestId: '00000000-0000-4000-8000-000000000099',
        retryable: false,
      },
    })
    await expect(pending).rejects.toThrow()
    expect(invalidate).not.toHaveBeenCalled()
  })
})

import { gitCommitDiffQuery, gitDiffFileQuery } from '@porcelain/client-runtime/git'
import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { gitContractFixtures } from '@porcelain/contracts/git'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  client: { mutation: vi.fn(), query: vi.fn() } as {
    mutation: (procedure: string, input: unknown) => Promise<unknown>
    query: (procedure: string, input: unknown) => Promise<unknown>
  },
  environment: { id: 'env-git-diff', token: 'paired' as string | null },
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

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

import { changesDiffSource, useDiffFile, useDiffReading } from './git-diff'
import { gitQueryKey } from './git-query-key'

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

function mockClient(mock: ReturnType<typeof createValidatingDaemonMock>) {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (outcome.ok) return outcome.value
    throw new Error('daemon mock failure')
  }
  return {
    mutation: (procedure: string, input: unknown) => dispatch('mutation', procedure, input),
    query: (procedure: string, input: unknown) => dispatch('query', procedure, input),
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-git-diff', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
})

describe('Mobile Git diff reads', () => {
  it('reads the working tree under the per-file identity', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useDiffFile('src/main.ts', { kind: 'working' }, true), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.hunks).toBeDefined())
    // `toBeDefined()` on both sides proved only that something arrived somewhere. The claim is
    // that *this* payload landed under *this* identity, so compare against the fixture.
    expect(result.current.hunks).toEqual(gitContractFixtures.gitDiffFile.output.hunks)
    expect(
      queryClient.getQueryData(
        gitQueryKey('env-git-diff', gitDiffFileQuery('/synthetic/repo', 'src/main.ts')),
      ),
    ).toEqual(gitContractFixtures.gitDiffFile.output)
  })

  it('waits instead of reading the working tree while a branch base is unknown', () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitDiffFile: () => ({ ok: true, value: gitContractFixtures.gitDiffFile.output }),
    })
    ctx.client = mockClient(mock)
    const source = changesDiffSource(undefined)
    const branchSource = { base: undefined, kind: 'branch' } as const
    const { result } = renderHook(() => useDiffFile('src/main.ts', branchSource, true), {
      wrapper: wrapper(new QueryClient()),
    })

    expect(source).toEqual({ kind: 'working' })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.hunks).toBeUndefined()
    expect(result.current.error).toBeNull()
    expect(mock.requests()).toEqual([])
  })

  it('reads a commit under its own immutable identity', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitCommitDiff: () => ({ ok: true, value: gitContractFixtures.gitCommitDiff.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(
      () => useDiffFile('src/main.ts', { hash: 'abc1234', kind: 'commit' }, true),
      { wrapper: wrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.hunks).toBeDefined())
    expect(result.current.status).toBeUndefined()
    expect(
      queryClient.getQueryData(
        gitQueryKey(
          'env-git-diff',
          gitCommitDiffQuery('/synthetic/repo', 'abc1234', 'src/main.ts'),
        ),
      ),
    ).toBeDefined()
  })

  it('keys the reading by scope so working and branch never share a cache entry', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      diffReading: () => ({ ok: true, value: gitContractFixtures.diffReading.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const working = renderHook(() => useDiffReading({ type: 'working' }, true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(working.result.current.reading).toBeDefined())

    renderHook(() => useDiffReading({ type: 'branch' }, true), { wrapper: wrapper(queryClient) })
    await waitFor(() =>
      expect(mock.requests().filter((request) => request.procedure === 'diffReading')).toHaveLength(
        2,
      ),
    )
    expect(mock.requests().map((request) => request.input)).toEqual([
      { repoPath: '/synthetic/repo', scope: { type: 'working' } },
      { repoPath: '/synthetic/repo', scope: { type: 'branch' } },
    ])
  })
})

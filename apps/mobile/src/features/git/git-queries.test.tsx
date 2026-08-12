import {
  gitCommitModelsQuery,
  gitFlowQuery,
  gitLogQuery,
  gitRangeFlowQuery,
} from '@porcelain/client-runtime/git'
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
  environment: { id: 'env-git-reads', token: 'paired' as string | null },
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
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ctx.client,
}))

import { useCommitModels, useGitFlow, useGitLog, useGitRangeFlow } from './git-queries'
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
  ctx.environment = { id: 'env-git-reads', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
})

describe('Mobile Git reads', () => {
  it('caches the flow under its semantic identity and calls the catalog procedure', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitFlow: () => ({ ok: true, value: gitContractFixtures.gitFlow.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useGitFlow(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.groups).toBeDefined())
    expect(mock.requests()).toContainEqual({
      kind: 'query',
      procedure: 'gitFlow',
      input: '/synthetic/repo',
    })
    expect(
      queryClient.getQueryData(gitQueryKey('env-git-reads', gitFlowQuery('/synthetic/repo'))),
    ).toEqual(gitContractFixtures.gitFlow.output)
  })

  it('carries the history limit in the identity as well as the wire input', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitLog: () => ({ ok: true, value: gitContractFixtures.gitLog.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useGitLog(true), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.commits).toBeDefined())
    expect(mock.requests()).toContainEqual({
      kind: 'query',
      procedure: 'gitLog',
      input: { limit: 200, repoPath: '/synthetic/repo' },
    })
    expect(
      queryClient.getQueryData(gitQueryKey('env-git-reads', gitLogQuery('/synthetic/repo', 200))),
    ).toBeDefined()
  })

  it('keys the commit-model list to the daemon, with no project dimension', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      commitModels: () => ({ ok: true, value: gitContractFixtures.commitModels.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useCommitModels(true), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(queryClient.getQueryData(gitQueryKey('env-git-reads', gitCommitModelsQuery()))).toEqual(
      gitContractFixtures.commitModels.output,
    )
  })

  it('reports the range base and stays disabled while no project is open', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitRangeFlow: () => ({ ok: true, value: gitContractFixtures.gitRangeFlow.output }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useGitRangeFlow(), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(result.current.base).toBeDefined())
    expect(
      queryClient.getQueryData(gitQueryKey('env-git-reads', gitRangeFlowQuery('/synthetic/repo'))),
    ).toBeDefined()

    ctx.project = null
    const closed = renderHook(() => useGitRangeFlow(), { wrapper: wrapper(new QueryClient()) })
    expect(closed.result.current.groups).toBeUndefined()
    expect(mock.requests().filter((request) => request.procedure === 'gitRangeFlow')).toHaveLength(
      1,
    )
  })
})

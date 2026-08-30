import { gitHeadQuery, gitProjectKey, gitWorktreesQuery } from '@porcelain/client-runtime/git'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  client: { mutation: vi.fn(), query: vi.fn() },
  environment: { id: 'env-git-workspace', token: 'paired' as string | null },
  repoPath: '/synthetic/repo' as string | null,
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))

vi.mock('@/features/projects', () => ({
  useHubRepoPath: () => ctx.repoPath,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ctx.client,
}))

import { gitQueryKey } from '../git-query-key'
import { useGitWorkspace } from './git-queries'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function refetchInterval(queryClient: QueryClient, queryKey: readonly unknown[]): unknown {
  return (
    queryClient.getQueryCache().find({ queryKey })?.options as
      | { refetchInterval?: unknown }
      | undefined
  )?.refetchInterval
}

beforeEach(() => {
  ctx.environment = { id: 'env-git-workspace', token: 'paired' }
  ctx.repoPath = '/synthetic/repo'
  ctx.client.query.mockResolvedValue(undefined)
})

describe('Mobile Git workspace polling', () => {
  it('does not poll a bare workspace read without an active surface', () => {
    const queryClient = new QueryClient()
    renderHook(() => useGitWorkspace(), { wrapper: wrapper(queryClient) })
    const projectPath = gitProjectKey('/synthetic/repo')

    expect(
      refetchInterval(queryClient, gitQueryKey('env-git-workspace', gitHeadQuery(projectPath))),
    ).toBe(false)
    expect(
      refetchInterval(
        queryClient,
        gitQueryKey('env-git-workspace', gitWorktreesQuery(projectPath)),
      ),
    ).toBe(false)
  })

  it('polls only when the caller supplies an active surface', () => {
    const queryClient = new QueryClient()
    renderHook(() => useGitWorkspace({ enabled: true }), { wrapper: wrapper(queryClient) })
    const projectPath = gitProjectKey('/synthetic/repo')

    expect(
      refetchInterval(queryClient, gitQueryKey('env-git-workspace', gitHeadQuery(projectPath))),
    ).toBe(5_000)
    expect(
      refetchInterval(
        queryClient,
        gitQueryKey('env-git-workspace', gitWorktreesQuery(projectPath)),
      ),
    ).toBe(15_000)
  })
})

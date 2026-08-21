import { searchContractFixtures } from '@porcelain/contracts/search'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-search-query', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
  useHubRepoPath: () => ctx.project?.path ?? null,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useCodeSearch, useFileSearch, useTextSearch } from './use-search-data'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-search-query', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(async (_client: unknown, procedure: { name: string }) => {
    if (procedure.name === 'searchFiles') return searchContractFixtures.searchFiles.output
    if (procedure.name === 'searchText') return searchContractFixtures.searchText.output
    return searchContractFixtures.searchCode.output
  })
})

describe('mobile Search query adapters', () => {
  it('normalizes file input and preserves canonical wire fields', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useFileSearch('  src  ', true), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.results).toHaveLength(2))
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'searchFiles' }),
      { query: 'src', repoPath: '/synthetic/repo' },
    )
  })

  it('gates empty text input and passes code options distinctly', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const empty = renderHook(() => useTextSearch('   ', true), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(empty.result.current.isLoading).toBe(false))
    expect(ctx.callDaemon).not.toHaveBeenCalled()

    const { result } = renderHook(
      () =>
        useCodeSearch(
          {
            caseSensitive: true,
            exclude: 'generated/**',
            include: 'src/**',
            query: ' needle ',
            regex: true,
          },
          true,
        ),
      { wrapper: wrapper(queryClient) },
    )
    await waitFor(() => expect(result.current.result?.files).toHaveLength(1))
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'searchCode' }),
      {
        caseSensitive: true,
        exclude: 'generated/**',
        include: 'src/**',
        query: 'needle',
        regex: true,
        repoPath: '/synthetic/repo',
      },
    )
  })
})

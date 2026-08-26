import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  client: {
    searchFiles: { query: vi.fn() },
    searchText: { query: vi.fn() },
  },
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'beelink', platform: 'linux', version: '0.52.1' }),
}))
vi.mock('@renderer/stores/project-selection', () => ({
  useProjectSelectionStore: (selector: (state: { project: typeof ctx.project }) => unknown) =>
    selector({ project: ctx.project }),
}))
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ client: ctx.client }),
  },
}))

import { searchContractFixtures } from '@porcelain/contracts/search'
import { useFileSearch, useTextSearch } from './search-queries'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
  ctx.client.searchFiles.query.mockReset()
  ctx.client.searchText.query.mockReset()
})

describe('Web Search query adapters', () => {
  it('normalizes file input and returns contract-valid results', async () => {
    ctx.client.searchFiles.query.mockResolvedValue(searchContractFixtures.searchFiles.output)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useFileSearch('  src  ', true), {
      wrapper: wrapper(queryClient),
    })

    await waitFor(() => expect(result.current.results).toHaveLength(2))
    expect(ctx.client.searchFiles.query).toHaveBeenCalledWith({
      query: 'src',
      repoPath: '/synthetic/repo',
    })
  })

  it('keeps empty text input disabled and exposes transport errors', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const empty = renderHook(() => useTextSearch('   '), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(empty.result.current.isFetching).toBe(false))
    expect(ctx.client.searchText.query).not.toHaveBeenCalled()

    ctx.client.searchText.query.mockRejectedValue(new Error('search unavailable'))
    const failed = renderHook(() => useTextSearch('needle'), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(failed.result.current.error?.message).toBe('search unavailable'))
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-files-read', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  repo: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.repo,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ mutation: vi.fn(), query: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})
vi.mock('./files-interests', () => ({
  useFilesDirectoryInterest: vi.fn(),
  useFilesViewerInterest: vi.fn(),
}))
vi.mock('./files-store', () => ({
  useFilesStore: (selector: (state: { showHidden: boolean }) => unknown) =>
    selector({ showHidden: false }),
}))

import { useDirEntries, useFileContents } from './files-reads'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(
    async (_client: unknown, procedure: { name: string }): Promise<unknown> => {
      if (procedure.name === 'readDir') {
        return [
          {
            hidden: false,
            kind: 'file',
            name: 'main.ts',
            path: '/synthetic/repo/main.ts',
            pinned: false,
          },
        ]
      }
      return { content: 'const main = true', type: 'text' }
    },
  )
  ctx.environment = { id: 'env-files-read', token: 'paired' }
  ctx.repo = { name: 'repo', path: '/synthetic/repo' }
})

describe('mobile Files reads', () => {
  it('uses typed identities but preserves absolute readDir wire paths', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDirEntries('', true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'readDir' }),
      { path: '/synthetic/repo', repoPath: '/synthetic/repo', showHidden: false },
    )
    expect(result.current.entries[0]).toMatchObject({
      absolutePath: '/synthetic/repo/main.ts',
      path: 'main.ts',
    })
  })

  it('gates file content transport on pairing even when a repo path remains stored', async () => {
    ctx.environment = { id: 'env-files-read', token: null }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useFileContents('main.ts', true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.view).toBeUndefined()
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

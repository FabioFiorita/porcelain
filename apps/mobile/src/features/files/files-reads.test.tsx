import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  showHidden: false,
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
  useHubRepoPath: () => ctx.repo?.path ?? null,
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
    selector({ showHidden: ctx.showHidden }),
}))

import { useDirEntries, useFileContents } from './files-reads'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.showHidden = false
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
  it('filters hidden cached rows immediately without copying them into the visible query cache', async () => {
    ctx.showHidden = true
    ctx.callDaemon.mockResolvedValue([
      {
        hidden: false,
        kind: 'file',
        name: 'main.ts',
        path: '/synthetic/repo/main.ts',
        pinned: false,
      },
      {
        hidden: true,
        kind: 'file',
        name: 'private.ts',
        path: '/synthetic/repo/private.ts',
        pinned: false,
      },
    ])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result, rerender } = renderHook(() => useDirEntries('', true), {
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(2))
    ctx.callDaemon.mockImplementation(() => new Promise(() => {}))
    ctx.showHidden = false
    rerender()
    expect(result.current.entries.map((entry) => entry.name)).toEqual(['main.ts'])
    expect(result.current.isLoading).toBe(false)
    ctx.showHidden = true
    rerender()
    expect(result.current.entries).toHaveLength(2)
  })

  it.each(['environment', 'worktree', 'pairing'] as const)(
    'does not retain another owner’s rows after changing %s',
    async (change) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const { result, rerender } = renderHook(() => useDirEntries('', true), {
        wrapper: wrapper(client),
      })
      await waitFor(() => expect(result.current.entries).toHaveLength(1))
      ctx.callDaemon.mockImplementation(() => new Promise(() => {}))
      ctx.showHidden = true
      if (change === 'environment') ctx.environment = { id: 'other', token: 'paired' }
      if (change === 'worktree') ctx.repo = { name: 'other', path: '/synthetic/other' }
      if (change === 'pairing') ctx.environment = { id: 'env-files-read', token: null }
      rerender()
      expect(result.current.entries).toEqual([])
    },
  )

  it('keeps cached rows while toggling hidden entries and deactivating a folder', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result, rerender } = renderHook(({ active }) => useDirEntries('', active), {
      initialProps: { active: true },
      wrapper: wrapper(client),
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    ctx.callDaemon.mockImplementation(() => new Promise(() => {}))
    ctx.showHidden = true
    rerender({ active: true })
    expect(result.current.entries[0]?.name).toBe('main.ts')
    expect(result.current.isLoading).toBe(false)
    ctx.showHidden = false
    rerender({ active: false })
    expect(result.current.entries[0]?.name).toBe('main.ts')
  })
  it('keeps Windows daemon tree entries visible with relative routes and original host paths', async () => {
    ctx.repo = { name: 'repo', path: 'C:\\synthetic\\repo' }
    ctx.callDaemon.mockResolvedValue([
      {
        name: 'main.ts',
        kind: 'file',
        path: 'C:\\synthetic\\repo\\src\\main.ts',
        hidden: false,
        pinned: true,
      },
      {
        name: 'other.ts',
        kind: 'file',
        path: 'C:\\synthetic\\repo-other\\other.ts',
        hidden: false,
        pinned: false,
      },
    ])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDirEntries('src', true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.entries[0]).toMatchObject({
      absolutePath: 'C:\\synthetic\\repo\\src\\main.ts',
      path: 'src/main.ts',
      pinned: true,
    })
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'readDir' }),
      {
        path: 'src',
        projectPath: 'C:\\synthetic\\repo',
        showHidden: false,
      },
    )
  })

  it('uses the project-relative readDir wire model', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useDirEntries('', true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'readDir' }),
      { path: '.', projectPath: '/synthetic/repo', showHidden: false },
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-files-mutation', token: 'paired' } as {
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
vi.mock('@/features/git', () => ({
  invalidateGitWorkingTree: (): Promise<void> => Promise.resolve(),
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ mutation: vi.fn(), query: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useFileWrites } from './files-mutations'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(
    async (_client: unknown, procedure: { name: string }): Promise<unknown> =>
      procedure.name === 'duplicatePath' ? 'docs/guide copy.md' : undefined,
  )
  ctx.environment = { id: 'env-files-mutation', token: 'paired' }
  ctx.repo = { name: 'repo', path: '/synthetic/repo' }
})

describe('mobile Files mutations', () => {
  it('sends relative mutation contracts and awaits duplicate output effects', async () => {
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useFileWrites(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.createFile('docs', 'empty.txt')
      await expect(result.current.duplicate('docs/guide.md')).resolves.toBe('docs/guide copy.md')
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'createFile' }),
      { path: 'docs/empty.txt', projectPath: '/synthetic/repo' },
    )
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'duplicatePath' }),
      { path: 'docs/guide.md', projectPath: '/synthetic/repo' },
    )
  })

  it('does not normalize a retained repo path or call transport while unpaired', async () => {
    ctx.environment = { id: 'env-files-mutation', token: null }
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useFileWrites(), { wrapper: wrapper(queryClient) })
    await act(async () => {
      await result.current.createFile('', 'ignored.txt')
      await expect(result.current.duplicate('docs/guide.md')).resolves.toBeNull()
    })
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

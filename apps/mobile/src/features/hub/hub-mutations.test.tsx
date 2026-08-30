import type { HubWorktree } from '@porcelain/contracts/projects'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  environment: null as { id: string; activeRepoPath: string | null } | null,
}))

const callProjectDaemon = vi.hoisted(() => vi.fn())

vi.mock('@/features/projects', () => ({
  callProjectDaemon,
  projectsQueryKey: (environmentId: string, query: unknown) => ['daemon', environmentId, query],
}))

vi.mock('@/features/remote', () => ({
  activeProjectPathOf: (environment: { activeRepoPath: string | null } | null): string | null =>
    environment?.activeRepoPath ?? null,
  environmentActions: { setActiveProjectPath: vi.fn() },
  getEnvironment: (id: string) => (ctx.environment?.id === id ? ctx.environment : null),
}))

import { environmentActions } from '@/features/remote'
import { useCreateHubWorktree, useRemoveHubProject, useRetireHubWorktree } from './hub-mutations'

const environment = {
  activeRepoPath: '/synthetic/projects/alpha',
  baseUrl: 'http://127.0.0.1:43118',
  createdAt: 1,
  enabled: true,
  endpoints: ['http://127.0.0.1:43118'],
  icon: 'desktop' as const,
  id: 'env-hub-mutations',
  nickname: 'test',
  preferredEndpoint: 'http://127.0.0.1:43118',
  token: 'pc_client_test',
}

const worktree: HubWorktree = {
  branch: 'topic',
  id: 'wt-alpha-topic',
  isPrimary: false,
  name: 'topic',
  path: '/synthetic/projects/alpha-worktrees/topic',
  projectId: 'proj-alpha',
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

function createHarness(): {
  queryClient: QueryClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

beforeEach(() => {
  ctx.environment = { id: environment.id, activeRepoPath: environment.activeRepoPath }
  callProjectDaemon.mockReset()
  vi.mocked(environmentActions.setActiveProjectPath).mockReset()
  vi.mocked(environmentActions.setActiveProjectPath).mockImplementation(
    async (id: string, path: string | null): Promise<void> => {
      if (ctx.environment?.id === id) {
        ctx.environment = { ...ctx.environment, activeRepoPath: path }
      }
    },
  )
})

describe('Mobile Hub mutations', () => {
  it('creates a Worktree without waiting for concurrent cache invalidations', async () => {
    const invalidation = deferred<void>()
    const { queryClient, wrapper } = createHarness()
    callProjectDaemon.mockResolvedValue(worktree)
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockReturnValue(invalidation.promise)
    const hook = renderHook(() => useCreateHubWorktree(), { wrapper })

    let creating: Promise<HubWorktree> | undefined
    act(() => {
      creating = hook.result.current.create(environment, {
        branch: 'topic',
        projectId: 'proj-alpha',
      })
    })

    await expect(creating).resolves.toEqual(worktree)
    expect(invalidateQueries).toHaveBeenCalledTimes(3)

    invalidation.resolve()
  })

  it('awaits selected-Worktree cleanup but not its cache invalidation', async () => {
    const invalidation = deferred<void>()
    const selection = deferred<void>()
    const { queryClient, wrapper } = createHarness()
    callProjectDaemon.mockResolvedValue(undefined)
    vi.mocked(environmentActions.setActiveProjectPath).mockImplementation(
      async (id: string, path: string | null): Promise<void> => {
        await selection.promise
        if (ctx.environment?.id === id) {
          ctx.environment = { ...ctx.environment, activeRepoPath: path }
        }
      },
    )
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockReturnValue(invalidation.promise)
    const hook = renderHook(() => useRetireHubWorktree(), { wrapper })

    let retiring: Promise<void> | undefined
    act(() => {
      retiring = hook.result.current.retire(environment, {
        ...worktree,
        path: environment.activeRepoPath,
      })
    })

    await waitFor(() => expect(environmentActions.setActiveProjectPath).toHaveBeenCalledOnce())
    if (retiring === undefined) throw new Error('retire did not start')
    let settled = false
    void retiring.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    selection.resolve()
    await expect(retiring).resolves.toBeUndefined()
    expect(invalidateQueries).toHaveBeenCalledTimes(3)

    invalidation.resolve()
  })

  it('removes a Project without waiting for cache invalidation', async () => {
    const invalidation = deferred<void>()
    const { queryClient, wrapper } = createHarness()
    callProjectDaemon.mockResolvedValue(undefined)
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockReturnValue(invalidation.promise)
    const hook = renderHook(() => useRemoveHubProject(), { wrapper })

    let removal: Promise<void> | undefined
    act(() => {
      removal = hook.result.current.remove(environment, 'proj-alpha')
    })

    await expect(removal).resolves.toBeUndefined()
    expect(invalidateQueries).toHaveBeenCalledTimes(3)

    invalidation.resolve()
  })
})

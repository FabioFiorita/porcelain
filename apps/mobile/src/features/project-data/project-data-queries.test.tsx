import { projectDataContractFixtures } from '@porcelain/contracts/project-data'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-project-data-query', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
}))
vi.mock('@/features/git', () => ({
  useGitFlow: () => ({ error: null, groups: [], isLoading: false }),
  useInvalidateGitGrouping: () => async () => {},
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useCompanionGitVisibility, useProjectNotes } from './project-data-queries'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-project-data-query', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue(projectDataContractFixtures.repoNotes.output)
})

describe('mobile useProjectNotes / visibility gating', () => {
  it('loads notes when active and a project is selected', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useProjectNotes(true), { wrapper: wrapper(queryClient) })

    await waitFor(() =>
      expect(result.current.notes).toBe(projectDataContractFixtures.repoNotes.output),
    )
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'repoNotes' }),
      '/synthetic/repo',
    )
  })

  it('does not query when inactive or no project is selected', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const inactive = renderHook(() => useProjectNotes(false), { wrapper: wrapper(queryClient) })
    expect(inactive.result.current.notes).toBeUndefined()
    expect(ctx.callDaemon).not.toHaveBeenCalled()

    ctx.project = null
    const missing = renderHook(() => useProjectNotes(true), { wrapper: wrapper(queryClient) })
    expect(missing.result.current.notes).toBeUndefined()
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })

  it('gates visibility on enabled', async () => {
    ctx.callDaemon.mockResolvedValue(projectDataContractFixtures.companionGitVisibility.output)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const disabled = renderHook(() => useCompanionGitVisibility(false), {
      wrapper: wrapper(queryClient),
    })
    expect(disabled.result.current.hidden).toBeUndefined()
    expect(ctx.callDaemon).not.toHaveBeenCalled()

    const enabled = renderHook(() => useCompanionGitVisibility(true), {
      wrapper: wrapper(queryClient),
    })
    await waitFor(() => expect(enabled.result.current.hidden).toBe(true))
  })
})

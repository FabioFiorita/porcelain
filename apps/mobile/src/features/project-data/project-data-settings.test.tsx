import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-project-data-settings', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  gitFlow: vi.fn(),
  invalidateGrouping: vi.fn(),
  order: [] as string[],
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/git', () => ({
  useGitFlow: (options: unknown) => ctx.gitFlow(options),
  useInvalidateGitGrouping: () => ctx.invalidateGrouping,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useReviewLayers } from './project-data-settings'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-project-data-settings', token: 'paired' }
  ctx.order = []
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(async (_client: unknown, procedure: { name: string }) => {
    if (procedure.name === 'setRepoLayers') {
      ctx.order.push('write')
      return undefined
    }
    return { layers: [{ label: 'Docs', pattern: 'docs/**' }], custom: true }
  })
  ctx.gitFlow.mockReturnValue({
    error: null,
    groups: [{ files: [{ connects: [], path: 'src/a.ts', status: 'modified' }], layer: 'Other' }],
    isLoading: false,
  })
  ctx.invalidateGrouping.mockImplementation(async () => {
    ctx.order.push('invalidate')
  })
})

describe('mobile useReviewLayers', () => {
  it('previews layer patterns against the Git flow at the slow settings rate', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useReviewLayers('/synthetic/repo'), {
      wrapper: wrapper(queryClient),
    })

    expect(ctx.gitFlow).toHaveBeenCalledWith({ pollMs: 15_000 })
    expect(result.current.changedPaths).toEqual(['src/a.ts'])
  })

  it('regroups the Git flows only after the layer write lands', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useReviewLayers('/synthetic/repo'), {
      wrapper: wrapper(queryClient),
    })

    await act(async () => {
      expect(await result.current.save([{ label: 'Docs', pattern: 'docs/**' }])).toBe(true)
    })

    await waitFor(() => expect(ctx.order).toEqual(['write', 'invalidate']))
    expect(ctx.invalidateGrouping).toHaveBeenCalledWith('/synthetic/repo')
  })
})

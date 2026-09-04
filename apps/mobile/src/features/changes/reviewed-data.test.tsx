import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env', token: 'paired' },
  repoPath: '/repo' as string | null,
}))
vi.mock('@/features/remote', () => ({
  isPaired: () => true,
  useActiveEnvironment: () => ctx.environment,
  environmentActions: { recordReachabilitySuccess: vi.fn(), recordReachabilityFailure: vi.fn() },
}))
vi.mock('@/features/projects', () => ({ useHubRepoPath: () => ctx.repoPath }))
vi.mock('@/features/remote/use-active-environment', () => ({}))
vi.mock('@/lib/daemon/client', () => ({ getDaemonClient: () => ({}) }))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useReviewed } from './reviewed-data'

function wrapper(): (props: { children: ReactNode }) => React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => ctx.callDaemon.mockReset())

describe('mobile reviewed wire compatibility', () => {
  it('uses the legacy working inputs and scoped branch inputs', async () => {
    ctx.callDaemon.mockResolvedValue([])
    const working = renderHook(() => useReviewed({ type: 'working' }, true), { wrapper: wrapper() })
    await waitFor(() => expect(ctx.callDaemon).toHaveBeenCalled())
    expect(ctx.callDaemon.mock.calls[0]?.[2]).toBe('/repo')
    act(() => working.result.current.onToggle('a.ts', true))
    await waitFor(() =>
      expect(
        ctx.callDaemon.mock.calls.find((call) => call[1]?.name === 'setReviewed')?.[2],
      ).toBeDefined(),
    )
    expect(ctx.callDaemon.mock.calls.find((call) => call[1]?.name === 'setReviewed')?.[2]).toEqual({
      paths: ['a.ts'],
      repoPath: '/repo',
      reviewed: true,
    })

    ctx.callDaemon.mockClear()
    renderHook(() => useReviewed({ type: 'branch', base: 'develop' }, true), { wrapper: wrapper() })
    await waitFor(() =>
      expect(ctx.callDaemon.mock.calls.map((call) => call[2])).toContainEqual({
        repoPath: '/repo',
        scope: { type: 'branch', base: 'develop' },
      }),
    )
  })
})

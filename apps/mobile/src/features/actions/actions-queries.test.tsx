import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-actions-query', token: 'paired' } as {
    id: string
    token: string | null
  } | null,
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})
vi.mock('@/lib/daemon/environment', () => ({
  isPaired: (env: { token: string | null } | null) => env !== null && env.token !== null,
}))

import { useActions } from './actions-queries'
import { actionsListKeyForProject } from './actions-query-key'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-actions-query', token: 'paired' }
  ctx.project = { name: 'repo', path: '/synthetic/repo' }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue([...actionsContractFixtures.actions.output])
})

describe('mobile useActions', () => {
  it('filters where === local and uses the list identity key', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useActions(true), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.actions.length).toBeGreaterThan(0))
    expect(result.current.actions.every((a) => a.where !== 'local')).toBe(true)
    expect(result.current.actions.some((a) => a.id === 'action-build')).toBe(true)
    expect(result.current.actions.some((a) => a.id === 'action-serve')).toBe(false)

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'actions' }),
      '/synthetic/repo',
    )

    const key = actionsListKeyForProject('env-actions-query', '/synthetic/repo')
    expect(key[2]).toEqual({
      domain: 'actions',
      name: 'list',
      projectPath: '/synthetic/repo',
    })
  })

  it('gates inactive and unpaired reads', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const inactive = renderHook(() => useActions(false), { wrapper: wrapper(queryClient) })
    expect(inactive.result.current.actions).toEqual([])
    expect(ctx.callDaemon).not.toHaveBeenCalled()

    ctx.environment = { id: 'env-actions-query', token: null }
    const unpaired = renderHook(() => useActions(true), { wrapper: wrapper(queryClient) })
    expect(unpaired.result.current.actions).toEqual([])
  })
})

import { taskFixture } from '@porcelain/contracts/tasks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LAPTOP, LAPTOP_ID, REVOKED, REVOKED_ID, STUDIO, STUDIO_ID } from './test-support'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environments: [] as { id: string; token: string | null }[],
}))

vi.mock('@/features/remote', () => ({
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useEnvironments: () => ctx.environments,
  getEnvironment: (id: string) => ctx.environments.find((entry) => entry.id === id) ?? null,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (environment: { id: string }) => ({ id: environment.id }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { MissingEnvironmentTargetError, useTaskActions } from './tasks-mutations'
import { tasksTableKey } from './tasks-query-key'

const CREATED = taskFixture({ id: '00000000-0000-4000-8000-000000000501', shortId: 'T-4' })

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environments = [STUDIO, LAPTOP, REVOKED]
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue(CREATED)
})

describe('mobile useTaskActions', () => {
  it('routes a create to the named Environment and refetches only its table', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useTaskActions(), { wrapper: wrapper(queryClient) })

    await result.current.add(LAPTOP_ID, { title: 'Capture the follow-up' })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      { id: LAPTOP_ID },
      expect.objectContaining({ name: 'createTask' }),
      { title: 'Capture the follow-up' },
    )
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(LAPTOP_ID), exact: true })
  })

  it('routes an update to the row’s own Environment, not the first one', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useTaskActions(), { wrapper: wrapper(queryClient) })

    await result.current.update(STUDIO_ID, { taskId: CREATED.id, status: 'done' })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      { id: STUDIO_ID },
      expect.objectContaining({ name: 'updateTask' }),
      { taskId: CREATED.id, status: 'done' },
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(STUDIO_ID), exact: true })
  })

  it('refuses an unchosen Environment instead of guessing a machine', async () => {
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useTaskActions(), { wrapper: wrapper(queryClient) })

    await expect(result.current.add(undefined, { title: 'Homeless' })).rejects.toBeInstanceOf(
      MissingEnvironmentTargetError,
    )
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })

  it('refuses to write to an Environment whose token was revoked', async () => {
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useTaskActions(), { wrapper: wrapper(queryClient) })

    await expect(result.current.add(REVOKED_ID, { title: 'Nowhere' })).rejects.toThrow()
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })

  it('refetches after a failed write — the daemon may still have taken it', async () => {
    ctx.callDaemon.mockRejectedValue(new Error('boom'))
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const { result } = renderHook(() => useTaskActions(), { wrapper: wrapper(queryClient) })

    await expect(result.current.add(STUDIO_ID, { title: 'Doomed' })).rejects.toThrow()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tasksTableKey(STUDIO_ID), exact: true })
  })
})

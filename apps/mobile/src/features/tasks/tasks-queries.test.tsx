import { taskFixture } from '@porcelain/contracts/tasks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LAPTOP, LAPTOP_ID, REVOKED, STUDIO, STUDIO_ID } from './test-support'

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
// The fake client carries its Environment id so a test can prove WHICH daemon was asked.
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (environment: { id: string }) => ({ id: environment.id }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useTasks } from './tasks-queries'
import { tasksTableKey } from './tasks-query-key'

const STUDIO_TASK = taskFixture({
  id: '00000000-0000-4000-8000-000000000401',
  shortId: 'T-1',
  title: 'Studio task',
  updatedAt: '2026-01-03T00:00:00.000Z',
})
const LAPTOP_TASK = taskFixture({
  id: '00000000-0000-4000-8000-000000000402',
  shortId: 'T-9',
  title: 'Laptop task',
  updatedAt: '2026-01-05T00:00:00.000Z',
})

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function client(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  ctx.environments = [STUDIO, LAPTOP]
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation((_daemonClient: unknown, procedure: { name: string }) => {
    if (procedure.name !== 'listTasks') return Promise.reject(new Error('unexpected procedure'))
    return Promise.resolve([])
  })
})

describe('mobile useTasks', () => {
  it('fans listTasks out over every paired Environment and labels each row', async () => {
    const byEnvironment = new Map([
      [STUDIO_ID, [STUDIO_TASK]],
      [LAPTOP_ID, [LAPTOP_TASK]],
    ])
    ctx.callDaemon.mockImplementation((daemonClient: { id?: string }) =>
      Promise.resolve(byEnvironment.get(daemonClient.id ?? '') ?? []),
    )
    const queryClient = client()
    const { result } = renderHook(() => useTasks(), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    // Newest-updated first is `sortTaskRows`' order, not this hook's.
    expect(result.current.rows.map((row) => row.task.shortId)).toEqual(['T-9', 'T-1'])
    expect(result.current.rows.map((row) => row.environmentName)).toEqual(['Laptop', 'Studio'])
    expect(result.current.environments).toEqual([
      { id: STUDIO_ID, name: 'Studio' },
      { id: LAPTOP_ID, name: 'Laptop' },
    ])
    expect(queryClient.getQueryData(tasksTableKey(STUDIO_ID))).toEqual([STUDIO_TASK])
    expect(queryClient.getQueryData(tasksTableKey(LAPTOP_ID))).toEqual([LAPTOP_TASK])
  })

  it('never calls an Environment whose token was revoked', async () => {
    ctx.environments = [STUDIO, REVOKED]
    const { result } = renderHook(() => useTasks(), { wrapper: wrapper(client()) })

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(ctx.callDaemon).toHaveBeenCalledTimes(1)
    expect(result.current.environments.map((entry) => entry.id)).toEqual([STUDIO_ID])
  })

  it('drops an Environment that did not answer instead of showing stale rows', async () => {
    ctx.callDaemon.mockImplementation((daemonClient: { id?: string }) =>
      daemonClient.id === LAPTOP_ID
        ? Promise.reject(new Error('unreachable'))
        : Promise.resolve([STUDIO_TASK]),
    )
    const { result } = renderHook(() => useTasks(), { wrapper: wrapper(client()) })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.rows.map((row) => row.environmentName)).toEqual(['Studio'])
    expect(result.current.environments.map((entry) => entry.id)).toEqual([STUDIO_ID])
  })

  it('is loaded with nothing paired, so the board can say the board is empty', () => {
    ctx.environments = []
    const { result } = renderHook(() => useTasks(), { wrapper: wrapper(client()) })

    expect(result.current.isLoaded).toBe(true)
    expect(result.current.rows).toEqual([])
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

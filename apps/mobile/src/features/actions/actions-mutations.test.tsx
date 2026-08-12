import { actionsMutations } from '@porcelain/client-runtime/actions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { id: 'env-actions-mut', token: 'paired' } as {
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

import { useTrustAction } from './actions-mutations'
import { actionsListKeyForProject } from './actions-query-key'

const REPO = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV = 'env-actions-mut'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  ctx.environment = { id: ENV, token: 'paired' }
  ctx.project = { name: 'repo', path: REPO }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockResolvedValue(undefined)
})

describe('mobile useTrustAction', () => {
  it('trusts via contract procedure and invalidates list identity only', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const projectKey = actionsListKeyForProject(ENV, REPO)
    const otherKey = actionsListKeyForProject(ENV, OTHER)
    queryClient.setQueryData(projectKey, [])
    queryClient.setQueryData(otherKey, [])

    const { result } = renderHook(() => useTrustAction(), { wrapper: wrapper(queryClient) })
    await act(async () => {
      await result.current('action-serve')
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'trustActions' }),
      { repoPath: REPO, ids: ['action-serve'] },
    )
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()

    // Must not use procedure-name invalidation arrays.
    const affected = actionsMutations.trust.affectedQueries({
      repoPath: REPO,
      ids: ['action-serve'],
    })
    expect(affected.map((i) => i.name)).toEqual(['list', 'trust'])
  })
})

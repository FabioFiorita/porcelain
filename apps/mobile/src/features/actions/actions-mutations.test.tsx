import { actionsMutations } from '@porcelain/client-runtime/actions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  daemonDispatch,
  ENV_ID,
  hubInventoryKey,
  OTHER_PROJECT_ID,
  PROJECT_ID,
  REPO_PATH,
  UNKNOWN_PATH,
} from './test-support'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { enabled: true, id: 'env-actions-test', token: 'paired' } as {
    enabled: boolean
    id: string
    token: string | null
  } | null,
  project: { name: 'alpha', path: '/synthetic/projects/alpha' } as {
    name: string
    path: string
  } | null,
}))

vi.mock('@/features/remote', () => ({
  // Pure identity the subject reads from the same feature index; the store half is faked below.
  isEnabled: (environment: { enabled: boolean } | null): boolean => environment?.enabled ?? false,
  isPaired: (environment: { token: string | null } | null): boolean =>
    environment !== null && environment.token !== null,
  useActiveEnvironment: () => ctx.environment,
  // The selected checkout now comes off the Environment record, not a Projects hook.
  activeProjectPathOf: () => ctx.project?.path ?? null,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
  useHubRepoPath: () => ctx.project?.path ?? null,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ({ query: vi.fn(), mutation: vi.fn() }),
}))
vi.mock('@/lib/daemon/procedure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/daemon/procedure')>()
  return { ...actual, callDaemon: ctx.callDaemon }
})

import { useTrustAction } from './actions-mutations'
import { actionsListKeyForProject } from './actions-query-key'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function trustCalls(): unknown[] {
  return ctx.callDaemon.mock.calls.filter(
    (call: unknown[]) => (call[1] as { name: string }).name === 'trustActions',
  )
}

beforeEach(() => {
  ctx.environment = { enabled: true, id: ENV_ID, token: 'paired' }
  ctx.project = { name: 'alpha', path: REPO_PATH }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(daemonDispatch({ trustActions: () => undefined }))
})

describe('mobile useTrustAction', () => {
  it('trusts the owning Project and invalidates that list identity only', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const projectKey = actionsListKeyForProject(ENV_ID, PROJECT_ID)
    const otherKey = actionsListKeyForProject(ENV_ID, OTHER_PROJECT_ID)
    queryClient.setQueryData(projectKey, [])
    queryClient.setQueryData(otherKey, [])

    const { result } = renderHook(() => useTrustAction(), { wrapper: wrapper(queryClient) })
    // The target comes from the Hub inventory read; wait for it before trusting.
    await waitFor(() => expect(queryClient.getQueryData(hubInventoryKey(ENV_ID))).toBeDefined())
    await act(async () => {
      await result.current('action-serve')
    })

    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'trustActions' }),
      { projectId: PROJECT_ID, ids: ['action-serve'] },
    )
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBeFalsy()

    // Must not use procedure-name invalidation arrays.
    const affected = actionsMutations.trust.affectedQueries({
      projectId: PROJECT_ID,
      ids: ['action-serve'],
    })
    expect(affected.map((i) => i.name)).toEqual(['list', 'trust'])
    expect(affected.every((i) => i.projectId === PROJECT_ID)).toBe(true)
  })

  it('trusts nothing when the checkout matches no Worktree the daemon knows', async () => {
    ctx.project = { name: 'stray', path: UNKNOWN_PATH }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const projectKey = actionsListKeyForProject(ENV_ID, PROJECT_ID)
    queryClient.setQueryData(projectKey, [])

    const { result } = renderHook(() => useTrustAction(), { wrapper: wrapper(queryClient) })
    await waitFor(() => expect(queryClient.getQueryData(hubInventoryKey(ENV_ID))).toBeDefined())
    await act(async () => {
      await result.current('action-serve')
    })

    expect(trustCalls()).toEqual([])
    expect(queryClient.getQueryState(projectKey)?.isInvalidated).toBeFalsy()
  })
})

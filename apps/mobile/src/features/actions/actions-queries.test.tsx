import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { daemonDispatch, ENV_ID, PROJECT_ID, REPO_PATH, UNKNOWN_PATH } from './test-support'

const ctx = vi.hoisted(() => ({
  callDaemon: vi.fn(),
  environment: { enabled: true, id: 'env-actions-test', token: 'paired' } as {
    enabled: boolean
    id: string
    token: string | null
  } | null,
  project: { name: 'repo', path: '/synthetic/projects/alpha' } as {
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

import { useActions } from './actions-queries'
import { actionsListKeyForProject } from './actions-query-key'

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function listCalls(): unknown[] {
  return ctx.callDaemon.mock.calls.filter(
    (call: unknown[]) => (call[1] as { name: string }).name === 'actions',
  )
}

beforeEach(() => {
  ctx.environment = { enabled: true, id: ENV_ID, token: 'paired' }
  ctx.project = { name: 'alpha', path: REPO_PATH }
  ctx.callDaemon.mockReset()
  ctx.callDaemon.mockImplementation(
    daemonDispatch({ actions: () => [...actionsContractFixtures.actions.output] }),
  )
})

describe('mobile useActions', () => {
  it('reads the Project the active checkout belongs to and filters where === local', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useActions(true), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(result.current.actions.length).toBeGreaterThan(0))
    expect(result.current.actions.every((a) => a.where !== 'local')).toBe(true)
    expect(result.current.actions.some((a) => a.id === 'action-build')).toBe(true)
    expect(result.current.actions.some((a) => a.id === 'action-serve')).toBe(false)

    // The checkout path resolved through the Hub inventory into the stable Project id (#24).
    expect(ctx.callDaemon).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'actions' }),
      { projectId: PROJECT_ID },
    )

    const key = actionsListKeyForProject(ENV_ID, PROJECT_ID)
    expect(key[2]).toEqual({
      domain: 'actions',
      name: 'list',
      projectId: PROJECT_ID,
    })
    expect(queryClient.getQueryData(key)).toEqual([...actionsContractFixtures.actions.output])
  })

  it('never guesses a Project for a checkout the Hub does not know', async () => {
    ctx.project = { name: 'stray', path: UNKNOWN_PATH }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useActions(true), { wrapper: wrapper(queryClient) })

    await waitFor(() => expect(ctx.callDaemon).toHaveBeenCalled())
    await waitFor(() =>
      expect(
        ctx.callDaemon.mock.calls.some(
          (call: unknown[]) => (call[1] as { name: string }).name === 'hubInventory',
        ),
      ).toBe(true),
    )
    expect(listCalls()).toEqual([])
    expect(result.current.actions).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('gates inactive and unpaired reads', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const inactive = renderHook(() => useActions(false), { wrapper: wrapper(queryClient) })
    expect(inactive.result.current.actions).toEqual([])
    expect(listCalls()).toEqual([])

    ctx.environment = { enabled: true, id: ENV_ID, token: null }
    ctx.callDaemon.mockClear()
    const unpairedClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const unpaired = renderHook(() => useActions(true), { wrapper: wrapper(unpairedClient) })
    expect(unpaired.result.current.actions).toEqual([])
    expect(ctx.callDaemon).not.toHaveBeenCalled()
  })
})

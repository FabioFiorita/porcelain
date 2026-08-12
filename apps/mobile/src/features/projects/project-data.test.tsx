import { recentProjectsQuery } from '@porcelain/client-runtime/projects'
import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import { projectsContractFixtures } from '@porcelain/contracts/projects'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { environmentActions } from '@/lib/daemon/environments-store'
import { daemonSession } from '@/lib/daemon/session'
import {
  projectsQueryKey,
  useOpenProject,
  useProjectDirectories,
  useRecentProjects,
  useRemoveRecentProject,
  useSelectedProject,
} from './index'

type TestDaemonClient = {
  query: (procedure: string, input: unknown) => Promise<unknown>
  mutation: (procedure: string, input: unknown) => Promise<unknown>
}

type TestEnvironment = {
  id: string
  nickname: string
  icon: 'desktop' | 'terminal' | 'notebook'
  baseUrl: string
  endpoints: string[]
  preferredEndpoint: string
  createdAt: number
  activeRepoPath: string | null
  token: string | null
}

const alpha = projectsContractFixtures.openRepoPath.output
const beta = { path: '/synthetic/projects/beta', name: 'beta' }
const browse = projectsContractFixtures.browseDirs.output
const environmentId = 'env-projects-test'
const pairedEnvironment: TestEnvironment = {
  activeRepoPath: alpha.path,
  baseUrl: 'http://127.0.0.1:43118',
  createdAt: 1,
  endpoints: ['http://127.0.0.1:43118'],
  icon: 'desktop',
  id: environmentId,
  nickname: 'test',
  preferredEndpoint: 'http://127.0.0.1:43118',
  token: 'pc_client_test',
}

const ctx = vi.hoisted(() => ({
  client: null as TestDaemonClient | null,
  environment: null as TestEnvironment | null,
}))

vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: (): TestDaemonClient => {
    if (ctx.client === null) throw new Error('test client not installed')
    return ctx.client
  },
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  activeEnvironment: (): TestEnvironment | null => ctx.environment,
  environmentActions: { setActiveRepoPath: vi.fn() },
  useActiveEnvironment: (): TestEnvironment | null => ctx.environment,
}))

vi.mock('@/lib/daemon/session', () => ({
  daemonSession: { selectProject: vi.fn() },
}))

vi.mock('@/features/shell/shell-store', () => ({
  useShellStore: (selector: (state: { closeSheet: () => void }) => unknown): unknown =>
    selector({ closeSheet: vi.fn() }),
}))

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

type DaemonMockHandlers = Readonly<
  Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
>

function publicErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'Daemon mock public error'
}

function clientFromMock(mock: ValidatingDaemonMock): TestDaemonClient {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (!outcome.ok) {
      throw TRPCClientError.from(
        Object.assign(new Error(publicErrorMessage(outcome.error)), {
          data: {
            code: 'INTERNAL_SERVER_ERROR',
            httpStatus: 500,
            porcelain: outcome.error,
          },
        }),
      )
    }
    return outcome.value
  }

  return {
    mutation: (procedure, input) => dispatch('mutation', procedure, input),
    query: (procedure, input) => dispatch('query', procedure, input),
  }
}

function createProjectHarness(overrides: DaemonMockHandlers = {}): {
  mock: ValidatingDaemonMock
  client: TestDaemonClient
  wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, {
    recentRepos: () => ({ ok: true, value: [alpha, beta] }),
    openRepoPath: () => ({ ok: true, value: beta }),
    removeRecentRepo: () => ({ ok: true, value: undefined }),
    browseDirs: () => ({ ok: true, value: browse }),
    ...overrides,
  })
  const client = clientFromMock(mock)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { client, mock, wrapper }
}

beforeEach(() => {
  ctx.client = null
  ctx.environment = { ...pairedEnvironment }
  vi.mocked(environmentActions.setActiveRepoPath).mockReset()
  vi.mocked(environmentActions.setActiveRepoPath).mockImplementation(
    async (id: string, path: string | null): Promise<void> => {
      if (ctx.environment?.id === id) {
        ctx.environment = { ...ctx.environment, activeRepoPath: path }
      }
    },
  )
  vi.mocked(daemonSession.selectProject).mockReset()
})

describe('Mobile Projects adapter', () => {
  it('loads recent Projects with an environment-scoped typed identity', async () => {
    const { client, mock, wrapper } = createProjectHarness()
    ctx.client = client
    const hook = renderHook(() => useRecentProjects(true), { wrapper })

    await waitFor(() => expect(hook.result.current.projects).toEqual([alpha, beta]))

    expect(mock.requests()).toContainEqual({
      procedure: 'recentRepos',
      kind: 'query',
      input: { includeWorktrees: false },
    })
    expect(projectsQueryKey(environmentId, recentProjectsQuery(false))).toEqual([
      'daemon',
      environmentId,
      recentProjectsQuery(false),
    ])
  })

  it('browses a nullable root and reports validated daemon failures', async () => {
    const successHarness = createProjectHarness()
    ctx.client = successHarness.client
    const success = renderHook(() => useProjectDirectories(null, true), {
      wrapper: successHarness.wrapper,
    })

    await waitFor(() => expect(success.result.current.result).toEqual(browse))
    expect(successHarness.mock.requests()).toContainEqual({
      procedure: 'browseDirs',
      kind: 'query',
      input: null,
    })

    const failureHarness = createProjectHarness({
      browseDirs: () => ({
        ok: false,
        error: publicErrorFixtures['projects.not-found'],
      }),
    })
    ctx.client = failureHarness.client
    const failure = renderHook(() => useProjectDirectories('/missing', true), {
      wrapper: failureHarness.wrapper,
    })

    await waitFor(() =>
      expect(failure.result.current.error).toBe('The daemon could not be reached.'),
    )
  })

  it('opens from the daemon result, updates selection/session, and invalidates both recents', async () => {
    const { client, wrapper } = createProjectHarness()
    ctx.client = client
    const hook = renderHook(() => ({ open: useOpenProject(), queryClient: useQueryClient() }), {
      wrapper,
    })
    const falseKey = projectsQueryKey(environmentId, recentProjectsQuery(false))
    const trueKey = projectsQueryKey(environmentId, recentProjectsQuery(true))
    hook.result.current.queryClient.setQueryData(falseKey, [])
    hook.result.current.queryClient.setQueryData(trueKey, [])

    await act(async () => {
      await hook.result.current.open.open(beta.path)
    })

    expect(ctx.environment?.activeRepoPath).toBe(beta.path)
    expect(daemonSession.selectProject).toHaveBeenCalledWith(beta.path)
    expect(hook.result.current.queryClient.getQueryState(falseKey)?.isInvalidated).toBe(true)
    expect(hook.result.current.queryClient.getQueryState(trueKey)?.isInvalidated).toBe(true)
  })

  it('clears only the selected Project after remove', async () => {
    const { client, wrapper } = createProjectHarness()
    ctx.client = client
    const hook = renderHook(() => useRemoveRecentProject(), { wrapper })

    await act(async () => {
      await hook.result.current.remove(alpha.path)
    })
    expect(ctx.environment?.activeRepoPath).toBeNull()

    ctx.environment = { ...pairedEnvironment }
    await act(async () => {
      await hook.result.current.remove('/synthetic/projects/unrelated')
    })
    expect(ctx.environment?.activeRepoPath).toBe(alpha.path)
  })

  it('returns an empty inactive/unpaired surface and derives the selected summary', () => {
    const { client, wrapper } = createProjectHarness()
    ctx.client = client
    const selected = renderHook(() => useSelectedProject())
    expect(selected.result.current).toEqual(alpha)

    ctx.environment = { ...pairedEnvironment, token: null }
    const inactive = renderHook(() => useRecentProjects(true), { wrapper })
    expect(inactive.result.current).toEqual({ isLoading: false, loadError: null, projects: [] })
    expect(inactive.result.current.projects).toEqual([])
  })
})

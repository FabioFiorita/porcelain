import {
  filesPinsQuery,
  filesProjectKey,
  filesTreeSubtreeEffect,
} from '@porcelain/client-runtime/files'
import {
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitFlowQuery,
  gitLogQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
} from '@porcelain/client-runtime/git'
import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({
  client: { mutation: vi.fn(), query: vi.fn() } as {
    mutation: (procedure: string, input: unknown) => Promise<unknown>
    query: (procedure: string, input: unknown) => Promise<unknown>
  },
  environment: { id: 'env-git-writes', token: 'paired' as string | null },
  filesEffects: vi.fn(),
  preferences: { commitModel: 'luna', pullMode: 'merge' as 'merge' | 'rebase' },
  project: { name: 'repo', path: '/synthetic/repo' } as { name: string; path: string } | null,
}))

vi.mock('@/lib/daemon/environments-store', () => ({
  environmentActions: {
    recordReachabilityFailure: vi.fn(),
    recordReachabilitySuccess: vi.fn(),
  },
  useActiveEnvironment: () => ctx.environment,
}))
vi.mock('@/features/projects', () => ({
  useActiveProject: () => ctx.project,
}))
vi.mock('@/lib/daemon/client', () => ({
  getDaemonClient: () => ctx.client,
}))
// Files owns its own invalidation; Git hands it typed effects and nothing else.
vi.mock('@/features/files', () => ({
  invalidateFilesEffects: (...args: unknown[]): Promise<void> => {
    ctx.filesEffects(...args)
    return Promise.resolve()
  },
}))
vi.mock('@/features/settings/preferences-store', () => ({
  usePreferencesStore: Object.assign(
    (select: (state: typeof ctx.preferences) => unknown) => select(ctx.preferences),
    { getState: () => ctx.preferences },
  ),
}))

import { useDiscardFile, useFileStaging, usePush, useQuickCommand } from './git-mutations'
import { gitQueryKey } from './git-query-key'

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

/** The daemon's own words ride on the tRPC error message, exactly as the real transport sends them. */
function refusalMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'the daemon refused'
}

function mockClient(mock: ReturnType<typeof createValidatingDaemonMock>) {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (outcome.ok) return outcome.value
    const message = refusalMessage(outcome.error)
    throw TRPCClientError.from({
      error: {
        code: -32603,
        data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, porcelain: outcome.error },
        message,
      },
    })
  }
  return {
    mutation: (procedure: string, input: unknown) => dispatch('mutation', procedure, input),
    query: (procedure: string, input: unknown) => dispatch('query', procedure, input),
  }
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const PROJECT = '/synthetic/repo'

function seedProjectCache(queryClient: QueryClient, environmentId: string): void {
  for (const query of [
    gitFlowQuery(PROJECT),
    gitStatusQuery(PROJECT),
    gitDiffFileQuery(PROJECT, 'src/main.ts'),
    gitDiffReadingQuery(PROJECT, { type: 'working' }),
    gitSuggestionsQuery(PROJECT),
    gitLogQuery(PROJECT),
  ]) {
    queryClient.setQueryData(gitQueryKey(environmentId, query), {})
  }
}

beforeEach(() => {
  ctx.environment = { id: 'env-git-writes', token: 'paired' }
  ctx.project = { name: 'repo', path: PROJECT }
  ctx.preferences = { commitModel: 'luna', pullMode: 'merge' }
  ctx.filesEffects.mockReset()
})

describe('Mobile Git writes', () => {
  it('stages a file and refreshes only the working tree it moved', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitStageFile: () => ({ ok: true, value: undefined }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    seedProjectCache(queryClient, 'env-git-writes')
    const { result } = renderHook(() => useFileStaging(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.stageFile('src/main.ts')
    })

    expect(mock.requests()).toContainEqual({
      kind: 'mutation',
      procedure: 'gitStageFile',
      input: { path: 'src/main.ts', repoPath: PROJECT },
    })
    for (const query of [
      gitFlowQuery(PROJECT),
      gitStatusQuery(PROJECT),
      gitDiffFileQuery(PROJECT, 'src/main.ts'),
      gitDiffReadingQuery(PROJECT, { type: 'working' }),
      gitSuggestionsQuery(PROJECT),
    ]) {
      expect(queryClient.getQueryState(gitQueryKey('env-git-writes', query))?.isInvalidated).toBe(
        true,
      )
    }
    // Staging does not rewrite history.
    expect(
      queryClient.getQueryState(gitQueryKey('env-git-writes', gitLogQuery(PROJECT)))?.isInvalidated,
    ).toBeFalsy()
  })

  it('hands the discard consequences to Files as typed effects', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitDiscardFile: () => ({ ok: true, value: undefined }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useDiscardFile(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      await result.current.discardFile('src/main.ts')
    })

    const filesProject = filesProjectKey(PROJECT)
    expect(ctx.filesEffects).toHaveBeenCalledWith(queryClient, 'env-git-writes', [
      filesTreeSubtreeEffect(filesProject, 'src/main.ts'),
      { type: 'exact', query: filesPinsQuery(filesProject) },
    ])
  })

  it('rejects a push with git’s own words and leaves the cache untouched', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitPush: (): DaemonMockOutcome => ({
        ok: false,
        error: {
          category: 'conflict',
          code: 'git.working-tree-conflict',
          message: 'updates were rejected because the remote contains work you do not have',
          requestId: '00000000-0000-4000-8000-000000000099',
          retryable: false,
        },
      }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    seedProjectCache(queryClient, 'env-git-writes')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => usePush(), { wrapper: wrapper(queryClient) })

    await expect(result.current.push()).rejects.toThrow(
      /updates were rejected because the remote contains work you do not have/,
    )
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('gives each quick command its own consequences and reads the pull mode at call time', async () => {
    const mock = createValidatingDaemonMock(validatingCatalog, {
      gitQuickCommand: () => ({ ok: true, value: 'On branch main' }),
    })
    ctx.client = mockClient(mock)
    const queryClient = new QueryClient()
    seedProjectCache(queryClient, 'env-git-writes')
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useQuickCommand(), { wrapper: wrapper(queryClient) })

    await act(async () => {
      expect(await result.current.runCommand('status')).toBe('On branch main')
    })
    expect(invalidate).not.toHaveBeenCalled()

    ctx.preferences = { commitModel: 'luna', pullMode: 'rebase' }
    await act(async () => {
      await result.current.runCommand('pull')
    })

    expect(mock.requests()).toContainEqual({
      kind: 'mutation',
      procedure: 'gitQuickCommand',
      input: { command: 'pull', pullMode: 'rebase', repoPath: PROJECT },
    })
    await waitFor(() =>
      expect(
        queryClient.getQueryState(gitQueryKey('env-git-writes', gitLogQuery(PROJECT)))
          ?.isInvalidated,
      ).toBe(true),
    )
    expect(
      queryClient.getQueryState(gitQueryKey('env-git-writes', gitFlowQuery(PROJECT)))
        ?.isInvalidated,
    ).toBe(true)
  })
})

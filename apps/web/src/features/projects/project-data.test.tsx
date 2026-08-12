import { recentProjectsQuery } from '@porcelain/client-runtime/projects'
import { publicErrorFixtures } from '@porcelain/contracts'
import { projectsContractFixtures } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { useRepoStore } from '@renderer/stores/repo'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidatingTrpcHarness, type DaemonMockHandlers } from '../../hooks/trpc-test-harness'
import {
  isProjectsQueryKey,
  projectsQueryKey,
  useOpenProject,
  useProjectDirectories,
  useRecentProjects,
  useRemoveRecentProject,
} from './index'

const alpha = projectsContractFixtures.openRepoPath.output
const beta = { path: '/synthetic/projects/beta', name: 'beta' }
const browse = projectsContractFixtures.browseDirs.output
const daemonInfo = remoteContractFixtures.daemonInfo.output
const daemon = { host: daemonInfo.host, version: daemonInfo.version }

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: daemonInfo }),
    recentRepos: () => ({ ok: true, value: [alpha, beta] }),
    openRepoPath: () => ({ ok: true, value: beta }),
    removeRecentRepo: () => ({ ok: true, value: undefined }),
    browseDirs: () => ({ ok: true, value: browse }),
    ...overrides,
  }
}

beforeEach(() => {
  useRepoStore.setState({ repo: alpha })
})

describe('Web Projects adapter', () => {
  it('loads recent Projects with the false worktree identity and wire input', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())
    const hook = renderHook(() => useRecentProjects(), { wrapper })

    await waitFor(() => expect(hook.result.current).toEqual([alpha, beta]))

    expect(mock.requests()).toContainEqual({
      procedure: 'recentRepos',
      kind: 'query',
      input: undefined,
    })
    expect(projectsQueryKey(daemon, recentProjectsQuery(false))).toEqual([
      recentProjectsQuery(false),
      daemon,
    ])
    expect(isProjectsQueryKey(projectsQueryKey(daemon, recentProjectsQuery(false)))).toBe(true)
  })

  it('keeps directory roots nullable and exposes canonical failure messages', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({
        browseDirs: () => ({ ok: true, value: browse }),
      }),
    )
    const success = renderHook(() => useProjectDirectories(null, true), { wrapper })

    await waitFor(() => expect(success.result.current.result).toEqual(browse))
    expect(mock.requests()).toContainEqual({
      procedure: 'browseDirs',
      kind: 'query',
      input: null,
    })

    const failureHarness = createValidatingTrpcHarness(
      handlers({
        browseDirs: () => ({
          ok: false,
          error: publicErrorFixtures['projects.not-found'],
        }),
      }),
    )
    const failure = renderHook(() => useProjectDirectories('/missing', true), {
      wrapper: failureHarness.wrapper,
    })

    await waitFor(() =>
      expect(failure.result.current.error).toEqual({ message: 'The Project path was not found.' }),
    )
  })

  it('selects the daemon result, resets presentation on switch, and invalidates both recents', async () => {
    const resetPresentation = vi.fn()
    useRepoStore.setState({ resetProjectPresentation: resetPresentation })
    const { mock, wrapper } = createValidatingTrpcHarness(handlers())
    const hook = renderHook(
      () => ({
        open: useOpenProject(),
        queryClient: useQueryClient(),
        recent: useRecentProjects(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(hook.result.current.recent).toEqual([alpha, beta]))
    const trueKey = projectsQueryKey(daemon, recentProjectsQuery(true))
    hook.result.current.queryClient.setQueryData(trueKey, [])

    await act(async () => {
      await hook.result.current.open.open(beta.path, { resetPresentation: true })
    })

    expect(useRepoStore.getState().repo).toEqual(beta)
    expect(resetPresentation).toHaveBeenCalledOnce()
    expect(hook.result.current.queryClient.getQueryState(trueKey)?.isInvalidated).toBe(true)
    expect(
      mock.requests().filter((request) => request.procedure === 'recentRepos').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('clears only the selected Project after a successful remove', async () => {
    const { wrapper } = createValidatingTrpcHarness(handlers())
    const hook = renderHook(() => useRemoveRecentProject(), { wrapper })

    await act(async () => {
      await hook.result.current.remove(alpha.path)
    })

    expect(useRepoStore.getState().repo).toBeNull()
    useRepoStore.setState({ repo: alpha })
    await act(async () => {
      await hook.result.current.remove('/synthetic/projects/unrelated')
    })
    expect(useRepoStore.getState().repo).toEqual(alpha)
  })

  it('keeps a failed recent read on the empty welcome surface', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({
        recentRepos: () => ({
          ok: false,
          error: publicErrorFixtures['projects.unavailable'],
        }),
      }),
    )
    const hook = renderHook(() => useRecentProjects(), { wrapper })

    await waitFor(() => {
      expect(hook.result.current).toEqual([])
      expect(mock.requests()).toContainEqual({
        procedure: 'recentRepos',
        kind: 'query',
        input: undefined,
      })
    })
  })
})

import { recentProjectsQuery } from '@porcelain/client-runtime/projects'
import { publicErrorFixtures } from '@porcelain/contracts'
import { projectsContractFixtures, projectsProcedures } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidatingTrpcHarness, type DaemonMockHandlers } from '../../hooks/trpc-test-harness'
import { setBrowserEnvironmentConnections } from '../../lib/environment-sessions'
import {
  isProjectsQueryKey,
  projectsQueryKey,
  useCanvas,
  useCanvasList,
  useHubInventories,
  useHubInventory,
  useMintCanvasAccessToken,
  useOpenProject,
  useProjectDirectories,
  useRecentProjects,
  useRemoveRecentProject,
} from './index'
import { usePromoteCanvas, useRemoveHubWorktree } from './project-data'

const alpha = projectsContractFixtures.openRepoPath.output
const beta = { path: '/synthetic/projects/beta', name: 'beta' }
const browse = projectsContractFixtures.browseDirs.output
const inventory = projectsContractFixtures.hubInventory.output
const daemonInfo = remoteContractFixtures.daemonInfo.output
const daemon = { host: daemonInfo.host, version: daemonInfo.version }

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: daemonInfo }),
    recentRepos: () => ({ ok: true, value: [alpha, beta] }),
    openRepoPath: () => ({ ok: true, value: beta }),
    removeRecentRepo: () => ({ ok: true, value: undefined }),
    browseDirs: () => ({ ok: true, value: browse }),
    hubInventory: () => ({ ok: true, value: inventory }),
    ...overrides,
  }
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: alpha })
  setBrowserEnvironmentConnections([])
})

afterEach(() => {
  setBrowserEnvironmentConnections([])
  vi.unstubAllGlobals()
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
    useProjectSelectionStore.setState({ resetProjectPresentation: resetPresentation })
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

    expect(useProjectSelectionStore.getState().project).toEqual(beta)
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

    expect(useProjectSelectionStore.getState().project).toBeNull()
    useProjectSelectionStore.setState({ project: alpha })
    await act(async () => {
      await hook.result.current.remove('/synthetic/projects/unrelated')
    })
    expect(useProjectSelectionStore.getState().project).toEqual(alpha)
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

  it('returns live Hub inventory and omits the Environment when the query fails', async () => {
    const success = renderHook(() => useHubInventory(), {
      wrapper: createValidatingTrpcHarness(handlers()).wrapper,
    })
    await waitFor(() => expect(success.result.current).toEqual(inventory))

    const failure = renderHook(() => useHubInventory(), {
      wrapper: createValidatingTrpcHarness(
        handlers({
          hubInventory: () => ({
            ok: false,
            error: publicErrorFixtures['projects.unavailable'],
          }),
        }),
      ).wrapper,
    })
    await waitFor(() => expect(failure.result.current).toBeNull())
  })

  it('optimistically removes a Worktree while the daemon operation is pending', async () => {
    let finishRemove: (() => void) | undefined
    const removePending = new Promise<void>((resolve) => {
      finishRemove = resolve
    })
    const { wrapper } = createValidatingTrpcHarness(
      handlers({
        removeHubWorktree: async () => {
          await removePending
          return { ok: true, value: undefined }
        },
      }),
    )
    const hook = renderHook(
      () => ({ inventory: useHubInventory(), remove: useRemoveHubWorktree() }),
      { wrapper },
    )
    await waitFor(() => expect(hook.result.current.inventory).toEqual(inventory))

    let removal: Promise<void> | undefined
    act(() => {
      removal = hook.result.current.remove.remove({
        projectId: 'proj-alpha',
        worktreeId: 'wt-alpha-topic',
        environmentId: null,
      })
    })

    await waitFor(() =>
      expect(
        hook.result.current.inventory?.projects[0]?.worktrees.map((worktree) => worktree.id),
      ).toEqual(['wt-alpha-main']),
    )
    finishRemove?.()
    await act(async () => removal)
  })

  it('updates Hub inventories when browser Environment topology changes', async () => {
    const secondaryConnection = {
      id: 'connection-secondary',
      name: 'Secondary',
      url: 'http://127.0.0.1:43220',
      token: 'pc_client_secondary_secret',
    }
    const secondaryInventory = {
      ...inventory,
      environment: { ...inventory.environment, id: 'env-secondary', name: 'Secondary' },
      projects: [],
    }
    vi.stubGlobal(
      'WebSocket',
      class {
        onopen: (() => void) | undefined
        onmessage: ((event: MessageEvent) => void) | undefined
        onclose: (() => void) | undefined
        send(): void {}
        close(): void {}
      },
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ result: { data: secondaryInventory } }]), {
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
    setBrowserEnvironmentConnections([])
    const hook = renderHook(() => useHubInventories(), {
      wrapper: createValidatingTrpcHarness(handlers()).wrapper,
    })
    await waitFor(() => expect(hook.result.current).toHaveLength(1))

    await act(async () => {
      setBrowserEnvironmentConnections([secondaryConnection])
    })
    await waitFor(() => expect(hook.result.current).toHaveLength(2))
    expect(hook.result.current.map((entry) => entry.inventory.environment.name)).toEqual([
      inventory.environment.name,
      secondaryInventory.environment.name,
    ])

    await act(async () => {
      setBrowserEnvironmentConnections([])
    })
    await waitFor(() => expect(hook.result.current).toHaveLength(1))
    expect(hook.result.current[0]?.inventory.environment.name).toBe(inventory.environment.name)
  })

  it('lists Canvases for a Project and skips the call when unset', async () => {
    const list = projectsContractFixtures.listCanvases.output
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({ listCanvases: () => ({ ok: true, value: list }) }),
    )
    const hook = renderHook(
      ({ projectId }: { projectId: string | null }) => useCanvasList(projectId),
      {
        initialProps: { projectId: null as string | null },
        wrapper,
      },
    )
    expect(hook.result.current).toEqual([])
    expect(mock.requests().map((r) => r.procedure)).not.toContain('listCanvases')

    hook.rerender({ projectId: 'proj-alpha' })
    await waitFor(() => expect(hook.result.current).toEqual(list))
    expect(mock.requests()).toContainEqual({
      procedure: 'listCanvases',
      kind: 'query',
      input: { projectId: 'proj-alpha' },
    })
  })

  it('reads a single Canvas only once both ids are known', async () => {
    const read = projectsContractFixtures.readCanvas.output
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({ readCanvas: () => ({ ok: true, value: read }) }),
    )
    const hook = renderHook(() => useCanvas('proj-alpha', 'canvas-intent'), { wrapper })
    expect(hook.result.current.isLoading).toBe(true)

    await waitFor(() => expect(hook.result.current.canvas).toEqual(read))
    expect(mock.requests()).toContainEqual({
      procedure: 'readCanvas',
      kind: 'query',
      input: { projectId: 'proj-alpha', canvasId: 'canvas-intent' },
    })
  })

  it('addresses the Canvas list and read at a specific checkout', async () => {
    const list = projectsContractFixtures.listCanvases.output
    const read = projectsContractFixtures.readCanvas.output
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({
        listCanvases: () => ({ ok: true, value: list }),
        readCanvas: () => ({ ok: true, value: read }),
      }),
    )
    const hook = renderHook(
      () => ({
        list: useCanvasList('proj-alpha', '/synthetic/projects/alpha', null, 'wt-alpha-main'),
        canvas: useCanvas('proj-alpha', 'canvas-intent', '/synthetic/projects/alpha'),
      }),
      { wrapper },
    )

    await waitFor(() => expect(hook.result.current.canvas.canvas).toEqual(read))
    expect(mock.requests()).toContainEqual({
      procedure: 'listCanvases',
      kind: 'query',
      input: {
        projectId: 'proj-alpha',
        worktreeId: 'wt-alpha-main',
        worktreePath: '/synthetic/projects/alpha',
      },
    })
    expect(mock.requests()).toContainEqual({
      procedure: 'readCanvas',
      kind: 'query',
      input: {
        projectId: 'proj-alpha',
        canvasId: 'canvas-intent',
        worktreePath: '/synthetic/projects/alpha',
      },
    })
  })

  it('promotes a Canvas to the explicitly addressed checkout', async () => {
    const promoted = projectsProcedures.promoteCanvas.output.parse(
      projectsContractFixtures.promoteCanvas.output,
    )
    const input = projectsProcedures.promoteCanvas.input.parse(
      projectsContractFixtures.promoteCanvas.input,
    )
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({ promoteCanvas: () => ({ ok: true, value: promoted }) }),
    )
    const hook = renderHook(() => usePromoteCanvas(), { wrapper })

    let result: typeof promoted | null = null
    await act(async () => {
      result = await hook.result.current.promote(input)
    })

    expect(result).toEqual(promoted)
    expect(mock.requests()).toContainEqual({
      procedure: 'promoteCanvas',
      kind: 'mutation',
      input,
    })
  })

  it('mints a Canvas access token through the daemon', async () => {
    const minted = projectsContractFixtures.mintCanvasAccessToken.output
    const { mock, wrapper } = createValidatingTrpcHarness(
      handlers({ mintCanvasAccessToken: () => ({ ok: true, value: minted }) }),
    )
    const hook = renderHook(() => useMintCanvasAccessToken(), { wrapper })

    let token = ''
    await act(async () => {
      token = await hook.result.current.mint({ projectId: 'proj-alpha', canvasId: 'canvas-intent' })
    })

    expect(token).toBe(minted.token)
    expect(mock.requests()).toContainEqual({
      procedure: 'mintCanvasAccessToken',
      kind: 'mutation',
      input: { projectId: 'proj-alpha', canvasId: 'canvas-intent' },
    })
  })
})

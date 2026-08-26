import { projectsContractFixtures } from '@porcelain/contracts/projects'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createValidatingTrpcHarness, type DaemonMockHandlers } from '../../hooks/trpc-test-harness'
import { SHELL_HUB_INVENTORIES_QUERY_KEY } from './hub-inventories'
import { useOpenProject, useRemoveHubWorktree } from './project-data'

// The Electron shell reads the Hub tree through a separate shell-router query
// (hub-inventories.ts) — pin isBrowser false to exercise that path, same as
// project-selection.test.ts's windowInit suite.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

// shellTrpcClient is a tRPC proxy client — vi.spyOn can't attach to its dynamically
// generated procedure properties, so stub the whole module. Keeps `trpc` real: the
// harness below needs its actual React Query integration, not a fake.
vi.mock('@renderer/lib/trpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@renderer/lib/trpc')>()
  return {
    ...actual,
    shellTrpcClient: { hubInventories: { query: vi.fn().mockResolvedValue([]) } },
  }
})

const alpha = projectsContractFixtures.openRepoPath.output
const beta = { path: '/synthetic/projects/beta', name: 'beta' }
const daemonInfo = remoteContractFixtures.daemonInfo.output

function handlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: daemonInfo }),
    openRepoPath: () => ({ ok: true, value: beta }),
    ...overrides,
  }
}

beforeEach(() => {
  useProjectSelectionStore.setState({ project: alpha })
})

describe('useOpenProject on the Electron shell', () => {
  it('invalidates the shell hubInventories query, not just the per-Environment one', async () => {
    const { wrapper } = createValidatingTrpcHarness(handlers())
    const hook = renderHook(() => ({ open: useOpenProject(), queryClient: useQueryClient() }), {
      wrapper,
    })

    hook.result.current.queryClient.setQueryData(SHELL_HUB_INVENTORIES_QUERY_KEY, [])

    await act(async () => {
      await hook.result.current.open.open(beta.path)
    })

    await waitFor(() =>
      expect(
        hook.result.current.queryClient.getQueryState(SHELL_HUB_INVENTORIES_QUERY_KEY)
          ?.isInvalidated,
      ).toBe(true),
    )
  })

  it('optimistically removes a Worktree from the shell inventory while deletion is pending', async () => {
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
      () => ({ remove: useRemoveHubWorktree(), queryClient: useQueryClient() }),
      { wrapper },
    )
    const inventory = projectsContractFixtures.hubInventory.output
    hook.result.current.queryClient.setQueryData(SHELL_HUB_INVENTORIES_QUERY_KEY, [
      { environmentId: null, current: true, inventory },
    ])

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
        hook.result.current.queryClient
          .getQueryData<readonly { inventory: typeof inventory }[]>(
            SHELL_HUB_INVENTORIES_QUERY_KEY,
          )?.[0]
          ?.inventory.projects[0]?.worktrees.map((worktree) => worktree.id),
      ).toEqual(['wt-alpha-main']),
    )
    finishRemove?.()
    await act(async () => removal)
  })
})

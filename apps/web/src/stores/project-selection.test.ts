import type { ProjectSummary } from '@porcelain/client-runtime/projects'
import { shellTrpcClient, trpcClient } from '@renderer/lib/trpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectSelectionStore } from './project-selection'

// boot() skips windowInit entirely in the browser client (isBrowser), which is
// jsdom's default (no preload bridge). This suite tests the Electron windowInit
// branches, so pin isBrowser false.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false, isLinuxShell: false }))

// boot() drives the window-aware boot: it reads windowInit and branches on the
// mode, so we mock the tRPC client surface it (and restoreLastProject) touches.
vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: {
    openRepoPath: { mutate: vi.fn() },
    recentRepos: { query: vi.fn() },
  },
  shellTrpcClient: {
    windowInit: { query: vi.fn() },
  },
}))

const aProject: ProjectSummary = { path: '/x', name: 'x' }

describe('useProjectSelectionStore.boot', () => {
  beforeEach(() => {
    useProjectSelectionStore.setState({ project: null, restoring: true })
    vi.mocked(shellTrpcClient.windowInit.query).mockReset()
    vi.mocked(trpcClient.openRepoPath.mutate).mockReset()
    vi.mocked(trpcClient.recentRepos.query).mockReset()
  })

  it("mode 'open' opens the given repo", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'open', repoPath: '/x' })
    vi.mocked(trpcClient.openRepoPath.mutate).mockResolvedValue(aProject)

    await useProjectSelectionStore.getState().boot()

    expect(trpcClient.openRepoPath.mutate).toHaveBeenCalledWith('/x')
    expect(useProjectSelectionStore.getState().project).toEqual(aProject)
    expect(useProjectSelectionStore.getState().restoring).toBe(false)
  })

  it("mode 'restore' restores the last repo", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'restore' })
    vi.mocked(trpcClient.recentRepos.query).mockResolvedValue([aProject])
    vi.mocked(trpcClient.openRepoPath.mutate).mockResolvedValue(aProject)

    await useProjectSelectionStore.getState().boot()

    expect(trpcClient.recentRepos.query).toHaveBeenCalled()
    expect(useProjectSelectionStore.getState().project).toEqual(aProject)
    expect(useProjectSelectionStore.getState().restoring).toBe(false)
  })

  it("mode 'welcome' lands on the welcome screen", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'welcome' })

    await useProjectSelectionStore.getState().boot()

    expect(useProjectSelectionStore.getState().project).toBeNull()
    expect(useProjectSelectionStore.getState().restoring).toBe(false)
  })
})

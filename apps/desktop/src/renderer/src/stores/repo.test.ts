import type { RepoInfo } from '@backend/api'
import { shellTrpcClient, trpcClient } from '@renderer/lib/trpc'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRepoStore } from './repo'

// boot() skips windowInit entirely in the browser client (isBrowser), which is
// jsdom's default (no preload bridge). This suite tests the Electron windowInit
// branches, so pin isBrowser false.
vi.mock('@renderer/lib/platform', () => ({ isBrowser: false, isE2E: false }))

// boot() drives the window-aware boot: it reads windowInit and branches on the
// mode, so we mock the tRPC client surface it (and restoreLastRepo) touches.
vi.mock('@renderer/lib/trpc', () => ({
  trpcClient: {
    openRepoPath: { mutate: vi.fn() },
    recentRepos: { query: vi.fn() },
  },
  shellTrpcClient: {
    windowInit: { query: vi.fn() },
  },
}))

const aRepo: RepoInfo = { path: '/x', name: 'x' }

describe('useRepoStore.boot', () => {
  beforeEach(() => {
    useRepoStore.setState({ repo: null, restoring: true })
    vi.mocked(shellTrpcClient.windowInit.query).mockReset()
    vi.mocked(trpcClient.openRepoPath.mutate).mockReset()
    vi.mocked(trpcClient.recentRepos.query).mockReset()
  })

  it("mode 'open' opens the given repo", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'open', repoPath: '/x' })
    vi.mocked(trpcClient.openRepoPath.mutate).mockResolvedValue(aRepo)

    await useRepoStore.getState().boot()

    expect(trpcClient.openRepoPath.mutate).toHaveBeenCalledWith('/x')
    expect(useRepoStore.getState().repo).toBe(aRepo)
    expect(useRepoStore.getState().restoring).toBe(false)
  })

  it("mode 'restore' restores the last repo", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'restore' })
    vi.mocked(trpcClient.recentRepos.query).mockResolvedValue([aRepo])
    vi.mocked(trpcClient.openRepoPath.mutate).mockResolvedValue(aRepo)

    await useRepoStore.getState().boot()

    expect(trpcClient.recentRepos.query).toHaveBeenCalled()
    expect(useRepoStore.getState().repo).toBe(aRepo)
    expect(useRepoStore.getState().restoring).toBe(false)
  })

  it("mode 'welcome' lands on the welcome screen", async () => {
    vi.mocked(shellTrpcClient.windowInit.query).mockResolvedValue({ mode: 'welcome' })

    await useRepoStore.getState().boot()

    expect(useRepoStore.getState().repo).toBeNull()
    expect(useRepoStore.getState().restoring).toBe(false)
  })
})

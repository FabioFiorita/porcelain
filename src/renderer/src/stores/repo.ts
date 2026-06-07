import type { RepoInfo } from '@main/api'
import { trpcClient } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { create } from 'zustand'

interface RepoState {
  repo: RepoInfo | null
  restoring: boolean
  showHidden: boolean
  restoreLastRepo: () => Promise<void>
  openRepo: () => Promise<void>
  openRepoPath: (path: string) => Promise<void>
  /** Closes every tab, then opens the repo/worktree at `path`. The one place
   *  repo switching lives — project and worktree switchers both call this. */
  switchTo: (path: string) => Promise<void>
  toggleShowHidden: () => void
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repo: null,
  restoring: true,
  showHidden: false,
  restoreLastRepo: async () => {
    try {
      const [last] = await trpcClient.recentRepos.query()
      if (last) set({ repo: await trpcClient.openRepoPath.mutate(last.path) })
    } catch {
      // last repo may no longer exist; fall through to the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  openRepo: async () => {
    const repo = await trpcClient.openRepo.query()
    if (repo) set({ repo })
  },
  openRepoPath: async (path) => {
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  switchTo: async (path) => {
    if (path === get().repo?.path) return
    // cross-store getState() from a store action is the sanctioned pattern
    useTabsStore.getState().closeAllTabs()
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
}))

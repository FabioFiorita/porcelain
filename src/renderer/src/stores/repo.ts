import type { RepoInfo } from '@backend/api'
import { shellTrpcClient, trpcClient } from '@renderer/lib/trpc'
import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { create } from 'zustand'

interface RepoState {
  repo: RepoInfo | null
  restoring: boolean
  showHidden: boolean
  boot: () => Promise<void>
  restoreLastRepo: () => Promise<void>
  openRepo: () => Promise<void>
  openRepoPath: (path: string) => Promise<void>
  /** Closes every tab (and reaps the terminals — different cwd), then opens the
   *  repo/worktree at `path` in THIS window. The ProjectSwitcher and the
   *  WorktreeSwitcher's row click both call this for an in-place switch; each
   *  switcher ALSO offers a trailing "open in new window" button (useNewWindow)
   *  that leaves this window — and its terminals — untouched. */
  switchTo: (path: string) => Promise<void>
  toggleShowHidden: () => void
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repo: null,
  restoring: true,
  showHidden: false,
  boot: async () => {
    try {
      const init = await shellTrpcClient.windowInit.query()
      if (init.mode === 'open') {
        set({ repo: await trpcClient.openRepoPath.mutate(init.repoPath) })
      } else if (init.mode === 'restore') {
        await get().restoreLastRepo()
        return
      }
      // mode 'welcome' falls through to restoring:false with repo:null
    } catch {
      // ignore — land on the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
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
    // The shell only runs the native folder dialog; opening the returned path
    // through the daemon's openRepoPath records the recent + warms the file list.
    const path = await shellTrpcClient.openRepo.query()
    if (path) set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  openRepoPath: async (path) => {
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  switchTo: async (path) => {
    if (path === get().repo?.path) return
    // cross-store getState() from a store action is the sanctioned pattern. The new
    // repo has a different cwd, so the old repo's terminals are killed (closeAllTabs
    // only closes their views — `reset` reaps the PTYs).
    useTabsStore.getState().closeAllTabs()
    useTerminalsStore.getState().reset()
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
}))

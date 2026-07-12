import type { RepoInfo } from '@backend/api'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpcClient } from '@renderer/lib/trpc'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoPickerStore } from '@renderer/stores/repo-picker'
import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { create } from 'zustand'

interface RepoState {
  repo: RepoInfo | null
  restoring: boolean
  showHidden: boolean
  boot: () => Promise<void>
  restoreLastRepo: () => Promise<void>
  /** Opens the daemon-side repo picker (the native folder dialog is gone —
   *  remote-envs decision 5; repos are daemon paths, so local and remote share
   *  one browse code path). The picker calls `openRepoPath` on confirm. */
  openRepo: () => void
  openRepoPath: (path: string) => Promise<void>
  /** Closes every tab and clears this window's terminal views (the PTYs live on
   *  daemon-side — sessions survive a repo switch now, explicit kill only), then opens
   *  the repo/worktree at `path` in THIS window. The ProjectSwitcher and the
   *  WorktreeSwitcher's row click both call this for an in-place switch; each switcher
   *  ALSO offers a trailing "open in new window" button (useNewWindow) that leaves this
   *  window untouched. */
  switchTo: (path: string) => Promise<void>
  toggleShowHidden: () => void
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repo: null,
  restoring: true,
  showHidden: false,
  boot: async () => {
    // No shell in a browser, so there's no windowInit to ask (open-this-repo /
    // restore / welcome is a per-Electron-window decision). The daemon's recents
    // are the browser client's restore source — fall straight to them, keeping the
    // try/catch → welcome fallback restoreLastRepo already carries.
    if (isBrowser) {
      await get().restoreLastRepo()
      return
    }
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
  openRepo: () => {
    // Open the daemon-side directory browser (RepoPickerDialog). The native
    // folder dialog is gone (remote-envs decision 5): repos are daemon paths, so
    // the picker browses the DAEMON's filesystem — one code path local or remote.
    // The dialog confirms through openRepoPath (records the recent + warms files).
    useRepoPickerStore.getState().show()
  },
  openRepoPath: async (path) => {
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  switchTo: async (path) => {
    if (path === get().repo?.path) return
    // cross-store getState() from a store action is the sanctioned pattern. `reset` only
    // clears this window's terminal views — the PTYs survive the switch (explicit kill
    // only) and re-hydrate if the repo comes back; `use-terminals` re-filters the roster
    // to the new repo after openRepoPath resolves.
    useTabsStore.getState().closeAllTabs()
    useTerminalsStore.getState().reset()
    // Drop this window's live agent timelines too — the threads live on daemon-side (like
    // the PTYs) and re-hydrate on re-attach, but their in-memory state must not bleed across
    // a repo switch.
    useAgentThreadsStore.getState().reset()
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
}))

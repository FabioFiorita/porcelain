import type { ProjectPath, ProjectSummary } from '@porcelain/client-runtime/projects'
import { openProjectOnDaemon, recentProjectsOnDaemon } from '@renderer/features/projects'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpcClient, trpcClient } from '@renderer/lib/trpc'
import { useProjectPickerStore } from '@renderer/stores/project-picker'
import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { create } from 'zustand'

export interface ProjectSelectionStore {
  project: ProjectSummary | null
  restoring: boolean
  showHidden: boolean
  /** Presentation-only selection update used by the Projects feature adapter. */
  selectProject: (project: ProjectSummary | null) => void
  /** Clear this window's local presentation before an in-place Project switch. */
  resetProjectPresentation: () => void
  boot: () => Promise<void>
  restoreLastProject: () => Promise<void>
  /** Opens the daemon-side Project picker. */
  openProjectPicker: () => void
  openProject: (path: ProjectPath) => Promise<void>
  /** Closes local presentation before opening a different Project in this window. */
  switchProject: (path: ProjectPath) => Promise<void>
  toggleShowHidden: () => void
}

export const useProjectSelectionStore = create<ProjectSelectionStore>((set, get) => ({
  project: null,
  restoring: true,
  showHidden: false,
  selectProject: (project) => set({ project }),
  resetProjectPresentation: () => {
    useTabsStore.getState().closeAllTabs()
    useTerminalsStore.getState().reset()
  },
  boot: async () => {
    // No shell in a browser, so there's no windowInit to ask (open-this-repo /
    // restore / welcome is a per-Electron-window decision). The daemon's recents
    // are the browser client's restore source — fall straight to them, keeping the
    // try/catch → welcome fallback restoreLastProject already carries.
    if (isBrowser) {
      await get().restoreLastProject()
      return
    }
    try {
      const init = await shellTrpcClient.windowInit.query()
      if (init.mode === 'open') {
        set({ project: await openProjectOnDaemon(trpcClient, init.repoPath) })
      } else if (init.mode === 'restore') {
        await get().restoreLastProject()
        return
      }
      // mode 'welcome' falls through to restoring:false with project:null
    } catch {
      // ignore — land on the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  restoreLastProject: async () => {
    try {
      // includeWorktrees: the project switcher hides linked worktrees, but the last
      // Project the human had open may well BE a linked worktree — restore has to land back in it.
      const [last] = await recentProjectsOnDaemon(trpcClient, true)
      if (last) set({ project: await openProjectOnDaemon(trpcClient, last.path) })
    } catch {
      // last repo may no longer exist; fall through to the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  openProjectPicker: () => {
    useProjectPickerStore.getState().show()
  },
  openProject: async (path: ProjectPath) => {
    set({ project: await openProjectOnDaemon(trpcClient, path) })
  },
  switchProject: async (path: ProjectPath) => {
    if (path === get().project?.path) return
    // Hub navigation must not close or retarget existing Viewer tabs. PTYs already
    // outlive the selected checkout; `use-terminals` re-filters the roster after open.
    set({ project: await openProjectOnDaemon(trpcClient, path) })
  },
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
}))

import type { HubTarget } from '@porcelain/client-runtime/projects'
import { create } from 'zustand'

import { useProjectSelectionStore } from './project-selection'
import { type Tab, useTabsStore } from './tabs'

type ViewerFileContext = Readonly<{ path: string; target?: HubTarget }>

interface ViewerFileContextState {
  /** A rich diff can select a file without changing its enclosing Viewer tab. */
  pathByPane: Record<number, string | null>
  setPath: (paneIndex: number, path: string | null) => void
}

export const useViewerFileContextStore = create<ViewerFileContextState>((set) => ({
  pathByPane: {},
  setPath: (paneIndex, path) =>
    set((state) => {
      if ((state.pathByPane[paneIndex] ?? null) === path) return state
      return { pathByPane: { ...state.pathByPane, [paneIndex]: path } }
    }),
}))

function relativePath(path: string, repoPath: string | null): string {
  if (repoPath === null) return path
  // Tabs normally use '/' even on Windows, but persisted or externally opened
  // paths can retain '\\'. Compare in one separator form so a Windows file tab
  // still reaches gitFileLog with its required repository-relative path.
  const normalizedPath = path.replaceAll('\\', '/')
  const prefix = `${repoPath.replaceAll('\\', '/').replace(/\/+$/, '')}/`
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : path
}

function fileForTab(
  tab: Tab | undefined,
  selectedRepoPath: string | null,
  dynamicPath: string | null,
): string | null {
  if (tab === undefined) return null
  if (tab.kind === 'file') return relativePath(tab.path, tab.target?.path ?? selectedRepoPath)
  if (tab.kind === 'diff') return tab.path
  if (tab.kind === 'commit' || tab.kind === 'changeset') return dynamicPath
  return null
}

/**
 * The one file the focused Viewer pane is presently reading. Ordinary file and
 * standalone-diff tabs carry it themselves; commit and stacked readers report
 * their selected card through `setPath`. The History timeline consumes this
 * shared answer instead of knowing each viewer's internal navigation.
 */
export function useActiveViewerFileContext(): ViewerFileContext | null {
  const activePaneIndex = useTabsStore((state) => state.activePaneIndex)
  const tab = useTabsStore((state) => {
    const pane = state.panes[state.activePaneIndex]
    return pane?.tabs.find((candidate) => candidate.id === pane.activeTabId)
  })
  const dynamicPath = useViewerFileContextStore(
    (state) => state.pathByPane[activePaneIndex] ?? null,
  )
  const selectedRepoPath = useProjectSelectionStore((state) => state.project?.path ?? null)
  const path = fileForTab(tab, selectedRepoPath, dynamicPath)
  return path === null ? null : { path, target: tab?.target }
}

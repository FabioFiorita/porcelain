import { create } from 'zustand'

export type FileTab = { path: string; line?: number }
type FileTabs = { tabs: FileTab[]; activePath: string | null }
export const EMPTY_FILE_TABS: FileTabs = { tabs: [], activePath: null }
export function fileTabsOwner(
  environmentId: string | undefined,
  repoPath: string | null,
): string | null {
  return environmentId && repoPath ? JSON.stringify([environmentId, repoPath]) : null
}

export const useFileTabsStore = create<{
  owners: Record<string, FileTabs>
  open: (owner: string, path: string, line?: number) => void
  close: (owner: string, path: string) => void
  move: (owner: string, from: string, to: string) => void
  remove: (owner: string, path: string) => void
}>()((set) => ({
  owners: {},
  open: (owner, path, line) =>
    set((state) => {
      const current = state.owners[owner] ?? EMPTY_FILE_TABS
      const exists = current.tabs.some((tab) => tab.path === path)
      const tabs = exists
        ? current.tabs.map((tab) =>
            tab.path === path && line !== undefined ? { ...tab, line } : tab,
          )
        : [...current.tabs, { path, line }]
      return { owners: { ...state.owners, [owner]: { tabs, activePath: path } } }
    }),
  close: (owner, path) =>
    set((state) => {
      const current = state.owners[owner] ?? EMPTY_FILE_TABS
      const index = current.tabs.findIndex((tab) => tab.path === path)
      const tabs = current.tabs.filter((tab) => tab.path !== path)
      const activePath =
        current.activePath === path
          ? (tabs[Math.min(index, tabs.length - 1)]?.path ?? null)
          : current.activePath
      return { owners: { ...state.owners, [owner]: { tabs, activePath } } }
    }),
  move: (owner, from, to) =>
    set((state) => {
      const current = state.owners[owner]
      if (!current) return state
      const next = (path: string) =>
        path === from || path.startsWith(`${from}/`) ? to + path.slice(from.length) : path
      const tabs = current.tabs.map((tab) => ({ ...tab, path: next(tab.path) }))
      return {
        owners: {
          ...state.owners,
          [owner]: {
            tabs: tabs.filter(
              (tab, index) => tabs.findIndex((other) => other.path === tab.path) === index,
            ),
            activePath: current.activePath && next(current.activePath),
          },
        },
      }
    }),
  remove: (owner, path) =>
    set((state) => {
      const current = state.owners[owner]
      if (!current) return state
      const tabs = current.tabs.filter(
        (tab) => tab.path !== path && !tab.path.startsWith(`${path}/`),
      )
      const activePath = tabs.some((tab) => tab.path === current.activePath)
        ? current.activePath
        : (tabs.at(-1)?.path ?? null)
      return { owners: { ...state.owners, [owner]: { tabs, activePath } } }
    }),
}))

import { create } from 'zustand'

interface ZenState {
  /**
   * Zen mode: both sidebars collapsed for a distraction-free read. Toggled by Z
   * in the Review document; consumed by RepoShell (the one place both
   * SidebarProviders are reachable), which snapshots and restores the panels'
   * previous open state. Desktop-only — on phone the panels are overlay sheets
   * (already closed), so there's nothing to collapse.
   */
  zen: boolean
  toggle: () => void
}

export const useZenStore = create<ZenState>((set) => ({
  zen: false,
  toggle: () => set((s) => ({ zen: !s.zen })),
}))

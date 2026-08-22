import { create } from 'zustand'

import { type SurfaceId, SURFACES } from './surfaces'

/** Mirrors the desktop Settings dialog: General · Personalization · Companion · Remotes. */
export type SettingsSection = 'general' | 'personalization' | 'companion' | 'remotes'

/**
 * The surfaces the tablet's trailing panel currently holds, and which one it is showing.
 *
 * This is `apps/web`'s pair — `useSurfaceSessionStore.openTabs` and
 * `usePreferencesStore.sidebarTab` — under one roof, because the mobile shell has no separate
 * preferences store to split them across. The shape is what matters: a surface is *opened into*
 * the panel and *closed out of* it, so the panel can be empty (its launcher) and can hold
 * several at once, instead of always showing whichever surface a screen last reported.
 *
 * `activeSurface` is nullable for exactly that reason. It was non-null before, defaulting to
 * `files`, which is how the trailing panel ended up always showing something whether or not the
 * human had asked for it.
 */
type ShellState = {
  /** Surfaces open as tabs of the tablet's trailing panel, in strip order. */
  openSurfaces: readonly SurfaceId[]
  /** The tab being shown, or `null` when the panel is empty and showing its launcher. */
  activeSurface: SurfaceId | null
  /** Tablet navigation panel. Open by default — it is the window's navigation. */
  sidebarVisible: boolean
  /** Tablet Surfaces panel. */
  inspectorVisible: boolean
  settingsSection: SettingsSection
  /** Open a surface into the panel (or raise it, if it is already there) and show it. */
  openSurface: (surface: SurfaceId) => void
  /** Close one tab. The neighbour to its left becomes active; an empty strip shows the launcher. */
  closeSurface: (surface: SurfaceId) => void
  /** Show a tab that is already open. */
  setActiveSurface: (surface: SurfaceId) => void
  /** Replace the whole strip — the "close others / close all" family. */
  setOpenSurfaces: (surfaces: readonly SurfaceId[], activate?: SurfaceId) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setInspectorVisible: (visible: boolean) => void
  setSettingsSection: (section: SettingsSection) => void
}

/**
 * What the panel holds on a cold start.
 *
 * Files and Changes, in rail order: the two surfaces the review loop starts from, and the same
 * pair the web client leaves open by default. An empty strip would greet every launch with a
 * launcher, and a launcher is for a panel you have deliberately emptied.
 */
const DEFAULT_OPEN: readonly SurfaceId[] = ['files', 'changes']

/** Strip order is the rail's order, never insertion order — the same tabs must always read the same. */
function inRailOrder(surfaces: readonly SurfaceId[]): readonly SurfaceId[] {
  const wanted = new Set(surfaces)
  return SURFACES.filter((surface) => wanted.has(surface.id)).map((surface) => surface.id)
}

export const useShellStore = create<ShellState>()((set) => ({
  activeSurface: DEFAULT_OPEN[0] ?? null,
  inspectorVisible: true,
  openSurfaces: DEFAULT_OPEN,
  settingsSection: 'general',
  sidebarVisible: true,
  closeSurface: (surface) => {
    set((state) => {
      const index = state.openSurfaces.indexOf(surface)
      if (index === -1) return state
      const openSurfaces = state.openSurfaces.filter((open) => open !== surface)
      if (state.activeSurface !== surface) return { openSurfaces }
      // Fall back to the tab on the left, the way a browser does — the strip you were reading
      // stays under your thumb instead of jumping to the far end.
      return { activeSurface: openSurfaces[Math.max(0, index - 1)] ?? null, openSurfaces }
    })
  },
  openSurface: (surface) => {
    set((state) => ({
      activeSurface: surface,
      openSurfaces: state.openSurfaces.includes(surface)
        ? state.openSurfaces
        : inRailOrder([...state.openSurfaces, surface]),
    }))
  },
  setActiveSurface: (activeSurface) => {
    set({ activeSurface })
  },
  setInspectorVisible: (visible) => {
    set({ inspectorVisible: visible })
  },
  setOpenSurfaces: (surfaces, activate) => {
    set((state) => {
      const openSurfaces = inRailOrder(surfaces)
      if (activate !== undefined && openSurfaces.includes(activate)) {
        return { activeSurface: activate, openSurfaces }
      }
      if (state.activeSurface !== null && openSurfaces.includes(state.activeSurface)) {
        return { openSurfaces }
      }
      return { activeSurface: openSurfaces.at(-1) ?? null, openSurfaces }
    })
  },
  setSettingsSection: (settingsSection) => {
    set({ settingsSection })
  },
  toggleInspector: () => {
    set((state) => ({ inspectorVisible: !state.inspectorVisible }))
  },
  toggleSidebar: () => {
    set((state) => ({ sidebarVisible: !state.sidebarVisible }))
  },
}))

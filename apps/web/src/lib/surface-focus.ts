import type { SidebarTab } from '@renderer/stores/preferences'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useSurfaceSessionStore } from '@renderer/stores/surface-session'

/**
 * The surface painted in the right rail. An empty strip is the launcher — not Files —
 * even when the persisted preference still says `files`.
 */
export function visibleSurfaceTab(
  openTabs: readonly SidebarTab[],
  sidebarTab: SidebarTab,
): SidebarTab | null {
  if (openTabs.length === 0) return null
  return openTabs.includes(sidebarTab) ? sidebarTab : (openTabs[0] ?? null)
}

/** Files owns ⌘N / ⌘⇧N / ⌘D / ⌘⌫ only while that surface is the visible one. */
export function isFilesSurfaceFocused(): boolean {
  return (
    visibleSurfaceTab(
      useSurfaceSessionStore.getState().openTabs,
      usePreferencesStore.getState().sidebarTab,
    ) === 'files'
  )
}

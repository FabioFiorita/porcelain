import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SidebarTab } from './preferences'

const sidebarTabSchema = z.enum(['files', 'changes', 'history', 'git', 'canvas'])

/**
 * Surfaces the right rail is actually showing. Distinct from `preferences.sidebarTab`,
 * which persists the last requested surface and defaults to `files` even while the
 * launcher is up (RightSidebar starts with an empty strip).
 */
interface SurfaceSessionState {
  openTabs: SidebarTab[]
  setOpenTabs: (next: SidebarTab[] | ((current: SidebarTab[]) => SidebarTab[])) => void
}

const persistedSurfaceSessionSchema = z
  .object({
    openTabs: z.array(z.string()),
  })
  .partial()

/** Open surface tabs a persisted blob still describes; empty for anything else. */
export function hydrateSurfaceSession(persisted: unknown): { openTabs: SidebarTab[] } {
  const parsed = persistedSurfaceSessionSchema.safeParse(persisted)
  if (!parsed.success || parsed.data.openTabs === undefined) return { openTabs: [] }
  const openTabs: SidebarTab[] = []
  for (const tab of parsed.data.openTabs) {
    const known = sidebarTabSchema.safeParse(tab)
    if (known.success && !openTabs.includes(known.data)) openTabs.push(known.data)
  }
  return { openTabs }
}

export const useSurfaceSessionStore = create<SurfaceSessionState>()(
  persist(
    (set) => ({
      openTabs: [],
      setOpenTabs: (next) =>
        set((state) => ({
          openTabs: typeof next === 'function' ? next(state.openTabs) : next,
        })),
    }),
    {
      name: 'porcelain-surfaces',
      partialize: (state) => ({ openTabs: state.openTabs }),
      merge: (persisted, current): SurfaceSessionState => ({
        ...current,
        ...hydrateSurfaceSession(persisted),
      }),
    },
  ),
)

export function closeOtherSurfaces(tabs: readonly SidebarTab[], id: SidebarTab): SidebarTab[] {
  return tabs.includes(id) ? [id] : [...tabs]
}

export function closeSurfacesToLeft(tabs: readonly SidebarTab[], id: SidebarTab): SidebarTab[] {
  const index = tabs.indexOf(id)
  return index <= 0 ? [...tabs] : tabs.slice(index)
}

export function closeSurfacesToRight(tabs: readonly SidebarTab[], id: SidebarTab): SidebarTab[] {
  const index = tabs.indexOf(id)
  return index < 0 ? [...tabs] : tabs.slice(0, index + 1)
}

/** Drop `fromId` onto `toId` — the dragged tab takes that slot. */
export function moveSurface(
  tabs: readonly SidebarTab[],
  fromId: SidebarTab,
  toId: SidebarTab,
): SidebarTab[] {
  if (fromId === toId) return [...tabs]
  const from = tabs.indexOf(fromId)
  const to = tabs.indexOf(toId)
  if (from < 0 || to < 0) return [...tabs]
  const next = [...tabs]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return [...tabs]
  next.splice(to, 0, moved)
  return next
}

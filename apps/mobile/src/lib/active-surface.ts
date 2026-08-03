import { create } from 'zustand'

/**
 * Which product surface last had focus. Companion (sheet / inspector) reads this because
 * its own route is `/companion` and cannot see the tab underneath.
 */
export type ActiveSurface =
  | 'files'
  | 'changes'
  | 'history'
  | 'review'
  | 'board'
  | 'terminal'
  | 'settings'

type ActiveSurfaceState = {
  surface: ActiveSurface
  setSurface: (surface: ActiveSurface) => void
}

export const useActiveSurface = create<ActiveSurfaceState>((set) => ({
  setSurface: (surface): void => {
    set({ surface })
  },
  surface: 'review',
}))

import { create } from 'zustand'

import type { TabWithAlternate } from '@/lib/tab-alternates'

type TabRootFocusState = {
  roots: Record<TabWithAlternate, boolean>
  setRoot: (tab: TabWithAlternate, focused: boolean) => void
}

/** True only while that tab's *root* screen is focused (not a pushed child). */
export const useTabRootFocus = create<TabRootFocusState>((set) => ({
  roots: { changes: false, review: false },
  setRoot: (tab, focused): void => {
    set((state) => ({ roots: { ...state.roots, [tab]: focused } }))
  },
}))

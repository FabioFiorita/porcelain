import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'
import { create } from 'zustand'

import type { DualTabSlot } from './tab-faces'

type TabRootFocusState = {
  roots: Record<DualTabSlot, boolean>
  setRoot: (tab: DualTabSlot, focused: boolean) => void
}

/** True only while that tab’s *root* screen is focused (enables re-tap → alternate). */
export const useTabRootFocus = create<TabRootFocusState>()((set) => ({
  roots: { files: false, changes: false, review: false },
  setRoot: (tab, focused) => {
    set((state) => ({ roots: { ...state.roots, [tab]: focused } }))
  },
}))

/** Register that this dual-face tab’s root is focused. */
export function useTabRootFocusRegistration(tab: DualTabSlot): void {
  const focused = useIsFocused()
  const setRoot = useTabRootFocus((state) => state.setRoot)

  useEffect(() => {
    setRoot(tab, focused)
    return () => {
      setRoot(tab, false)
    }
  }, [focused, setRoot, tab])
}

import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'

import type { TabWithAlternate } from '@/lib/tab-alternates'
import { useTabRootFocus } from '@/lib/tab-root-focus'

/** Register that this tab's root screen is focused (enables re-tap → alternate). */
export function useTabRootFocusRegistration(tab: TabWithAlternate): void {
  const focused = useIsFocused()
  const setRoot = useTabRootFocus((state) => state.setRoot)

  useEffect(() => {
    setRoot(tab, focused)
    return (): void => {
      setRoot(tab, false)
    }
  }, [focused, setRoot, tab])
}

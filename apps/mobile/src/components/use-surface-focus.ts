import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'

import { type ActiveSurface, useActiveSurface } from '@/lib/active-surface'

/** Mark this surface as the companion context whenever the screen is focused. */
export function useSurfaceFocus(surface: ActiveSurface): void {
  const focused = useIsFocused()
  const setSurface = useActiveSurface((state) => state.setSurface)

  useEffect(() => {
    if (focused) setSurface(surface)
  }, [focused, setSurface, surface])
}

import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import type { SurfaceId } from './surfaces'

/**
 * One surface, mounted as a screen inside the Hub stack.
 *
 * A surface used to be a global tab with two faces crammed into it, because five surfaces had
 * to fit four tab slots. It is now reached through the Worktree that owns it, so the slot
 * pressure — and the dual-face store, and the re-tap-to-flip gesture — is gone. The surface's
 * own `phone` panel paints everything, header included.
 */
export function SurfaceScreen({ surface }: { surface: SurfaceId }): React.JSX.Element {
  const focused = useIsFocused()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const slots = surfaceSlots(surface)

  useEffect(() => {
    if (focused) setActiveSurface(surface)
  }, [focused, setActiveSurface, surface])

  return <slots.phone />
}

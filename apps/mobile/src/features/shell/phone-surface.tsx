import { useIsFocused } from 'expo-router'
import { useEffect } from 'react'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import type { SurfaceId } from './surfaces'
import type { DualTabSlot } from './tab-faces'
import { useTabFaces } from './tab-faces'
import { useTabRootFocusRegistration } from './tab-root-focus'

/**
 * Phone tab body for a dual-face slot or a fixed surface (Terminal). The tab knows which
 * surface it is showing; the surface's own `phone` panel paints everything, header included.
 */
export function PhoneSurface({
  slot,
  surface,
}: {
  /** Dual slot for re-tap registration; omit for fixed surfaces (terminal). */
  slot?: DualTabSlot
  /** Primary surface when not dual-face, or when face is primary. */
  surface: SurfaceId
}): React.JSX.Element {
  if (slot !== undefined) {
    return <DualFacePhoneSurface slot={slot} primary={surface} />
  }
  return <PhoneSurfaceBody surfaceId={surface} />
}

function DualFacePhoneSurface({
  slot,
  primary,
}: {
  slot: DualTabSlot
  primary: SurfaceId
}): React.JSX.Element {
  useTabRootFocusRegistration(slot)
  const face = useTabFaces((state) => {
    if (slot === 'files') return state.files
    if (slot === 'changes') return state.changes
    return state.review
  })

  const surfaceId: SurfaceId =
    slot === 'files'
      ? face === 'search'
        ? 'search'
        : primary
      : slot === 'changes'
        ? face === 'history'
          ? 'history'
          : primary
        : primary

  return <PhoneSurfaceBody surfaceId={surfaceId} />
}

function PhoneSurfaceBody({ surfaceId }: { surfaceId: SurfaceId }): React.JSX.Element {
  const focused = useIsFocused()
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)
  const slots = surfaceSlots(surfaceId)

  useEffect(() => {
    if (focused) {
      setActiveSurface(surfaceId)
    }
  }, [focused, setActiveSurface, surfaceId])

  // A surface owns its whole tab body — header, list, and detail view.
  return <slots.phone />
}

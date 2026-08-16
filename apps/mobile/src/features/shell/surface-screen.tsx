import { PhoneSurface } from './phone-surface'
import { ViewerCanvas } from './shell-columns'
import { useShellStore } from './shell-store'
import type { SurfaceId } from './surfaces'
import { useIsTablet } from './use-app-window'

type SurfaceScreenProps = {
  /** Phone route surface (primary face of a dual slot, or Terminal). */
  surface: SurfaceId
}

/**
 * Shared route body: tablet Slot shows store-driven viewer; phone uses dual-face
 * PhoneSurface chrome.
 */
export function SurfaceScreen({ surface }: SurfaceScreenProps): React.JSX.Element {
  const isTablet = useIsTablet()
  const activeSurface = useShellStore((state) => state.activeSurface)

  if (isTablet) {
    return <ViewerCanvas surfaceId={activeSurface} />
  }

  if (surface === 'files') {
    return <PhoneSurface slot="files" surface="files" />
  }
  if (surface === 'changes') {
    return <PhoneSurface slot="changes" surface="changes" />
  }
  if (surface === 'terminal') {
    return <PhoneSurface surface="terminal" />
  }

  // Orphan routes (history/search/board) still render their face if navigated to.
  return <PhoneSurface surface={surface} />
}

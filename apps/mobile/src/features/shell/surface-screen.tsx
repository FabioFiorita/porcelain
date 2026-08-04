import { Platform, useWindowDimensions } from 'react-native'
import { PocSurfaceScreen } from '@/features/poc/poc-screen'
import type { SurfaceId } from './mock-data'
import { ViewerCanvas } from './shell-chrome'
import { useShellStore } from './shell-store'

type SurfaceScreenProps = {
  /** Phone route surface. Tablet ignores this and uses the shell store. */
  surface: SurfaceId
}

/**
 * Shared route body: tablet Slot shows store-driven viewer; phone keeps tab POC.
 */
export function SurfaceScreen({ surface }: SurfaceScreenProps): React.JSX.Element {
  const { width, height } = useWindowDimensions()
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || Math.min(width, height) >= 768
  const activeSurface = useShellStore((state) => state.activeSurface)

  if (isTablet) {
    return <ViewerCanvas surfaceId={activeSurface} />
  }

  if (surface === 'history' || surface === 'search' || surface === 'board') {
    return <ViewerCanvas surfaceId={surface} />
  }

  const phoneSurface =
    surface === 'files' || surface === 'changes' || surface === 'review' || surface === 'terminal'
      ? surface
      : 'files'

  return <PocSurfaceScreen surface={phoneSurface} />
}

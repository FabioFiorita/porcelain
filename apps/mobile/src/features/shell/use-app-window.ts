import { useEffect, useState } from 'react'
import { Dimensions, Platform, type ScaledSize, useWindowDimensions } from 'react-native'

/**
 * Whether this device gets the multi-column shell rather than the tab shell.
 *
 * Every iPad is a tablet whatever its window size (Stage Manager can make an iPad narrower
 * than a phone and it is still an iPad); everything else is measured on its shortest side, so
 * an Android tablet qualifies in either orientation and a phone never does.
 *
 * One definition, read by the root layout, the route bodies, and anything that has to pick
 * between pushing a route and moving a column cursor.
 */
export function useIsTablet(): boolean {
  const { height, width } = useWindowDimensions()
  return isTabletSize(width, height)
}

/**
 * Same rule as `useIsTablet`, callable outside a component — module-load-time defaults (a
 * preference's initial value before anything has rendered) have no hook to read from. A
 * device's form factor does not change mid-session, so a one-time `Dimensions.get` read is
 * exactly as correct as the hook.
 */
export function isTabletFormFactor(): boolean {
  const { height, width } = Dimensions.get('window')
  return isTabletSize(width, height)
}

function isTabletSize(width: number, height: number): boolean {
  return (Platform.OS === 'ios' && Platform.isPad) || Math.min(width, height) >= 768
}

/**
 * Whether the app scene fills (nearly) the whole display.
 *
 * On iPad, Stage Manager / floating / split windows report a `window` size smaller
 * than `screen`. Fullscreen apps sit within a few points of the screen (status bar /
 * home indicator only).
 *
 * Re-subscribes on dimension changes so Stage Manager resize updates the header inset.
 */
export function useIsAppFullscreen(): boolean {
  const window = useWindowDimensions()
  const [screen, setScreen] = useState(() => Dimensions.get('screen'))

  useEffect(() => {
    const onChange = ({ screen: next }: { window: ScaledSize; screen: ScaledSize }): void => {
      setScreen(next)
    }
    const sub = Dimensions.addEventListener('change', onChange)
    return () => {
      sub.remove()
    }
  }, [])

  // Width is the strong signal (Stage Manager shrinks width first). Height always loses
  // a bit to status/home chrome even when “fullscreen”.
  const widthRatio = window.width / Math.max(screen.width, 1)
  const heightRatio = window.height / Math.max(screen.height, 1)
  return widthRatio >= 0.94 && heightRatio >= 0.88
}

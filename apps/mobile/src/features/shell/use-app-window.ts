import { useEffect, useState } from 'react'
import { Dimensions, type ScaledSize, useWindowDimensions } from 'react-native'

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

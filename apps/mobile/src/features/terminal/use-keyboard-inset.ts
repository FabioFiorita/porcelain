import { useEffect, useState } from 'react'
import { Dimensions, Keyboard, Platform } from 'react-native'

/**
 * How much of the screen the software keyboard is covering.
 *
 * The terminal grid is sized from the pane, and on iOS the keyboard floats over that pane
 * without resizing it — so without this the shell keeps `rows` for a height it no longer has,
 * and the prompt you are typing at sits behind the keyboard. Reserving the space shrinks the
 * grid instead, which sends a resize to the PTY and keeps the last line visible.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    // iOS reports the frame before the animation so the grid resizes with the keyboard rather
    // than after it; Android only emits the Did* pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (event) => {
      setInset(keyboardInsetFor(event.endCoordinates))
    })
    const hide = Keyboard.addListener(hideEvent, () => {
      setInset(0)
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return inset
}

/**
 * The height to reserve for a keyboard frame.
 *
 * Reserving `height` assumes a keyboard docked to the bottom of the screen, which is the only
 * shape a phone has. An iPad's floating (undocked or split) keyboard is a panel the human can
 * park anywhere — it covers the middle of the screen, not the bottom, and subtracting its
 * height there would take rows off a terminal for space the keyboard never occupied. So a frame
 * that does not reach the bottom of the screen reserves nothing; the pane keeps its full grid
 * and the human moves the panel.
 */
function keyboardInsetFor(frame: { height: number; screenY: number }): number {
  const screenHeight = Dimensions.get('screen').height
  // A pixel of slack: these frames arrive in points and can land fractionally short.
  const flushToBottom = frame.screenY + frame.height >= screenHeight - 1
  return flushToBottom ? frame.height : 0
}

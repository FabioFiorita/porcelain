import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

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
      setInset(event.endCoordinates.height)
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

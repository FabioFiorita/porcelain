import { Stack } from 'expo-router/stack'

/**
 * The Terminal tab is a real native stack: the roster pushes a session instead of swapping it
 * in behind a store flag, so the interactive pop gesture, the Android hardware back button and
 * re-tap-the-tab-to-return-to-root all come from the navigator.
 *
 * Headers stay hidden because a terminal wants every row of the screen, and the session screen
 * carries its own compact bar. Hiding the bar does not disable the pop gesture.
 */
export default function TerminalLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}

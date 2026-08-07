import { Stack } from 'expo-router/stack'

/**
 * The Terminal tab is a real native stack: the roster pushes a session instead of swapping it
 * in behind a store flag, so the Android hardware back button and re-tap-the-tab-to-return-to-
 * root come from the navigator.
 *
 * The session screen (`[id]`) presents as a full-screen modal rather than a plain push — a
 * terminal wants every row the display has, and `NativeTabs` has no supported way to hide just
 * the tab bar for one pushed screen: the classic `hidesBottomBarWhenPushed` trick doesn't exist
 * here, and dynamically hiding a tab trigger remounts the whole navigator, resetting every other
 * tab's position. A modal presents above the tab bar entirely, so it disappears with no side
 * effects elsewhere. Trade-off: iOS's edge-swipe-back gesture is a push-navigation convention
 * modals don't get — the session screen's own back arrow and the Android hardware back button
 * still dismiss it either way.
 *
 * Headers stay hidden because a terminal wants every row of the screen, and the session screen
 * carries its own compact bar.
 */
export default function TerminalLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  )
}

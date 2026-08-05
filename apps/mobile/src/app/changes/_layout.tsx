import { Stack } from 'expo-router/stack'

/**
 * The Changes tab is a real native stack: the list pushes its detail screens instead of
 * swapping them in behind a store flag. That hands the interactive pop gesture, the Android
 * hardware back button, and re-tap-the-tab-to-return-to-root back to the navigator, all of
 * which this tab used to hand-roll.
 *
 * Headers stay hidden because both detail screens carry chrome the native bar has no room for
 * — the full repo-relative path over two lines, plus the reviewed and comment actions. Hiding
 * the bar does not disable the pop gesture.
 */
export default function ChangesLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}

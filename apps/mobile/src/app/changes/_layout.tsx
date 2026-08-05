import { Stack } from 'expo-router/stack'

/**
 * The Changes tab is a real native stack: the list pushes its detail screens instead of
 * swapping them in behind a store flag. That hands the interactive pop gesture, the Android
 * hardware back button, and re-tap-the-tab-to-return-to-root back to the navigator, all of
 * which this tab used to hand-roll.
 *
 * `commit/` lives here too. History is not a tab — it is this tab's alternate face, reached by
 * re-tapping it — so its commit, file, and read-all screens belong to this navigator. Putting
 * them under an `/history` route instead would push outside the tab that is showing them.
 *
 * Headers stay hidden because every detail screen carries chrome the native bar has no room
 * for — the full repo-relative path over two lines, plus the reviewed and comment actions.
 * Hiding the bar does not disable the pop gesture.
 */
export default function ChangesLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />
}

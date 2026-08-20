import { Stack } from 'expo-router/stack'

/**
 * Console is a tab root, so it needs a stack of its own to have a native bar at all — a
 * `NativeTabs` trigger renders a screen, not a navigator, and there is nowhere else to declare
 * a title. The tab was a bare screen painting a `PhoneHeader` before this.
 *
 * One screen today. It gets a stack rather than a header hack because a Console with real
 * sessions pushes detail screens, and that is the navigator that will own them.
 */
export default function ConsoleLayout(): React.JSX.Element {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Console' }} />
    </Stack>
  )
}

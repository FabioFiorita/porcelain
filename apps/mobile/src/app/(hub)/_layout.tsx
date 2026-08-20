import { Stack } from 'expo-router/stack'

/**
 * The Hub tab is one native stack: the Worktree list pushes a Worktree, and a Worktree pushes
 * its surfaces and their detail screens. Three nested stacks (Files, Changes, Terminal) used to
 * do this job because each surface was its own tab; one stack replaces them now that a surface
 * is a screen rather than a tab.
 *
 * Detail routes stay direct children of this group so their URLs are unchanged — `/file/…`,
 * `/folder/…`, `/changes/file/…` — and every `router.push` in the feature panels keeps working.
 *
 * Headers stay hidden because every screen carries chrome the native bar has no room for.
 * Hiding the bar does not disable the pop gesture.
 *
 * The terminal session presents as a full-screen modal: a terminal wants every row the display
 * has, and `NativeTabs` has no supported way to hide just the tab bar for one pushed screen.
 */
export default function HubLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="terminal/[id]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  )
}

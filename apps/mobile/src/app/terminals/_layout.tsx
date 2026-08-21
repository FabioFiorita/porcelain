import { Stack } from 'expo-router/stack'

/**
 * Terminals is a tab root, so it needs a stack of its own for its screens to be pushed at all.
 *
 * It owns three screens because a terminal is three things on a phone: the list, the shell
 * itself, and the saved Actions that start one. No screen here wears a native bar — every one of
 * them draws `ScreenHeader` or `SheetBar` — so this layout declares presentation and nothing
 * else.
 */
export default function TerminalsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        A terminal wants every row the display has, which is why the session is a full-screen
        modal rather than a push: a pushed screen keeps the tab bar under it, and the tab bar is
        rows the grid could have had.
      */}
      <Stack.Screen name="[id]" options={{ presentation: 'fullScreenModal' }} />

      {/* Actions run against the selected Worktree. On a 3-pane board they sit in the same
          column as the Worktree list; a phone column cannot hold both, so they are a presented
          sheet off the list rather than a second scrolling region competing with it. */}
      <Stack.Screen
        name="actions"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 0.95],
          sheetCornerRadius: 20,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  )
}

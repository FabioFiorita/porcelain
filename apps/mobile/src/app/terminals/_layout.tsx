import { Stack } from 'expo-router/stack'

import { HeaderDoneButton } from '@/features/shell/header-actions'

/**
 * Terminals is a tab root, so it needs a stack of its own to have a native bar at all — a
 * `NativeTabs` trigger renders a screen, not a navigator, and there is nowhere else to declare
 * a title.
 *
 * It owns three screens because a terminal is three things on a phone: the list, the shell
 * itself, and the saved Actions that start one. The list's own toolbar is declared by the
 * screen (`terminals-screen.tsx`), which is where the state those buttons drive lives.
 */
export default function TerminalsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Terminals' }} />

      {/*
        A terminal wants every row the display has, which is why the session is a full-screen
        modal rather than a push — `NativeTabs` has no supported way to hide just the tab bar
        for one pushed screen. It still gets a real bar, because a modal with no bar has no
        visible way out, but a minimal one: no large title, no actions, and the session's own
        name is set by the screen.
      */}
      <Stack.Screen name="[id]" options={{ presentation: 'fullScreenModal' }} />

      {/* Actions run against the selected Worktree. On a 3-pane board they sit in the same
          column as the Worktree list; a phone column cannot hold both, so they are a presented
          sheet off the list rather than a second scrolling region competing with it. */}
      <Stack.Screen
        name="actions"
        options={{
          headerRight: () => <HeaderDoneButton testID="porcelain-terminals-actions-done" />,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 0.95],
          sheetCornerRadius: 20,
          sheetGrabberVisible: true,
          title: 'Actions',
        }}
      />
    </Stack>
  )
}

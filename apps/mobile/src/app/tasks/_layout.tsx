import { Stack } from 'expo-router/stack'

import { NewTaskHeaderAction } from '@/features/tasks'

/**
 * A presented sheet, not a pushed screen — the same shape the Hub stack uses. `formSheet` is
 * `UISheetPresentationController` on iOS and a Material bottom sheet on Android: detents, a
 * grabber, drag-to-dismiss and keyboard avoidance all come from the platform.
 *
 * Both Tasks sheets are forms, so they open nearly full height: a composer that starts at half
 * a screen puts its own fields under the keyboard.
 */
const SHEET = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.85, 0.99],
  sheetCornerRadius: 20,
  sheetGrabberVisible: true,
}

/** Tasks is a tab root; see `terminals/_layout.tsx` for why a tab root needs its own stack. */
export default function TasksLayout(): React.JSX.Element {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          headerRight: () => <NewTaskHeaderAction />,
          title: 'Tasks',
        }}
      />
      {/* Both sheets set their own `headerRight` from the draft they hold — Save and Add are
          disabled while a write is in flight, which the layout cannot know. `[id]` also sets
          its title to the Task's short id. */}
      <Stack.Screen name="new" options={{ ...SHEET, title: 'New Task' }} />
      <Stack.Screen name="[id]" options={{ ...SHEET, title: 'Task' }} />
    </Stack>
  )
}

import { Stack } from 'expo-router/stack'

/** Tasks is a tab root; see `console/_layout.tsx` for why a tab root needs its own stack. */
export default function TasksLayout(): React.JSX.Element {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Tasks' }} />
    </Stack>
  )
}

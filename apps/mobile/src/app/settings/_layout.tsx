import { Stack } from 'expo-router/stack'

/** Settings is a tab root; see `console/_layout.tsx` for why a tab root needs its own stack. */
export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Settings' }} />
    </Stack>
  )
}

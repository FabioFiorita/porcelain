import { Stack } from 'expo-router/stack'

export default function TerminalLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* `ScreenHeader` draws the title as a left header item; iOS always centres this one. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Terminal' }} />
      <Stack.Screen
        name="new"
        options={{
          contentStyle: { backgroundColor: 'transparent' },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.7, 1.0] as number[],
          sheetGrabberVisible: true,
          title: 'New terminal',
        }}
      />
      <Stack.Screen name="session/[id]" />
    </Stack>
  )
}

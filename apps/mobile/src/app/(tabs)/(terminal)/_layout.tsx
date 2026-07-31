import { Stack } from 'expo-router/stack'

export default function TerminalLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Terminal' }} />
    </Stack>
  )
}

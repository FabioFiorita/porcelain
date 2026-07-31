import { Stack } from 'expo-router/stack'

export default function TerminalLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Terminal' }} />
    </Stack>
  )
}

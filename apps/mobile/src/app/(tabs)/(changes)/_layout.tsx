import { Stack } from 'expo-router/stack'

export default function ChangesLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Changes' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
    </Stack>
  )
}

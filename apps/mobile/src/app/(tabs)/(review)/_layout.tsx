import { Stack } from 'expo-router/stack'

export default function ReviewLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Review' }} />
      <Stack.Screen name="board" options={{ title: 'Board' }} />
    </Stack>
  )
}

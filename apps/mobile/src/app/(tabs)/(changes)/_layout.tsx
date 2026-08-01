import { Stack } from 'expo-router/stack'

export default function ChangesLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* `ScreenHeader` draws the title as a left header item; iOS always centres this one. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Changes' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="reading" options={{ title: 'Read' }} />
      {/* `file` and `commit/[hash]` title themselves from their subject, so no title here. */}
      <Stack.Screen name="file" />
      <Stack.Screen name="commit/[hash]" />
    </Stack>
  )
}

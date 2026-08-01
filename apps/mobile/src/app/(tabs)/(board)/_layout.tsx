import { Stack } from 'expo-router/stack'

export default function BoardLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* `ScreenHeader` draws the title as a left header item; iOS always centres this one. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Board' }} />
    </Stack>
  )
}

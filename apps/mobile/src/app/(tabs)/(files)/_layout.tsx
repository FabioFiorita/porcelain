import { Stack } from 'expo-router/stack'

export default function FilesLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* `ScreenHeader` draws the title as a left header item; iOS always centres this one. */}
      <Stack.Screen
        name="index"
        options={{ headerLargeTitle: true, headerTitle: '', title: 'Files' }}
      />
      <Stack.Screen name="dir/[...path]" />
      <Stack.Screen name="file/[...path]" />
    </Stack>
  )
}

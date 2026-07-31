import { Stack } from 'expo-router/stack'

export default function FilesLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerLargeTitle: true, title: 'Files' }} />
    </Stack>
  )
}

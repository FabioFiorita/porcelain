import { Stack } from 'expo-router/stack'

import { useFilesTabBarIdentity } from '@/components/tab-bar-identity'

export default function FilesLayout(): React.JSX.Element {
  useFilesTabBarIdentity()

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Index swaps Files/Search faces — no large title (it stacked empty space under ScreenHeader). */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Files' }} />
      <Stack.Screen name="dir/[...path]" />
      <Stack.Screen name="file/[...path]" />
    </Stack>
  )
}

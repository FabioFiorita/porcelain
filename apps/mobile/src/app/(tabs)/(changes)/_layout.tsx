import { Stack } from 'expo-router/stack'

import { useChangesTabBarIdentity } from '@/components/tab-bar-identity'

export default function ChangesLayout(): React.JSX.Element {
  useChangesTabBarIdentity()

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Index swaps Changes/History faces in-place — not a push. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Changes' }} />
      <Stack.Screen name="reading" options={{ title: 'Read' }} />
      <Stack.Screen name="review" options={{ headerTitle: '', title: 'Review' }} />
      <Stack.Screen name="file" />
      <Stack.Screen name="commit/[hash]" />
      <Stack.Screen
        name="actions"
        options={{
          contentStyle: { backgroundColor: 'transparent' },
          presentation: 'formSheet',
          sheetAllowedDetents: [0.7, 1.0] as number[],
          sheetGrabberVisible: true,
          title: 'Actions',
        }}
      />
    </Stack>
  )
}

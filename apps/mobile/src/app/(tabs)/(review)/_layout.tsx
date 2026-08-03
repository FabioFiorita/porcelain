import { Stack } from 'expo-router/stack'

import { useReviewTabBarIdentity } from '@/components/tab-bar-identity'

const FORM_SHEET = {
  contentStyle: { backgroundColor: 'transparent' },
  presentation: 'formSheet',
  sheetAllowedDetents: [0.5, 1.0] as number[],
  sheetGrabberVisible: true,
} as const

export default function ReviewLayout(): React.JSX.Element {
  useReviewTabBarIdentity()

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* Index swaps Review/Board faces in-place — not a push. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Review' }} />
      <Stack.Screen name="chapter" options={{ title: 'Intent' }} />
      <Stack.Screen name="evidence" options={{ title: 'Proof' }} />
      <Stack.Screen name="comments" options={{ title: 'Comments' }} />
      <Stack.Screen name="comment" options={{ ...FORM_SHEET, title: 'Comment' }} />
      <Stack.Screen name="card" options={{ ...FORM_SHEET, title: 'Card' }} />
    </Stack>
  )
}

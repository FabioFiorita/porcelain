import { Stack } from 'expo-router/stack'

const FORM_SHEET = {
  contentStyle: { backgroundColor: 'transparent' },
  presentation: 'formSheet',
  sheetAllowedDetents: [0.5, 1.0] as number[],
  sheetGrabberVisible: true,
} as const

export default function ReviewLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Review' }} />
      {/* Board is pushed (and re-tap alternate), not a tab. */}
      <Stack.Screen name="board" options={{ headerTitle: '', title: 'Board' }} />
      <Stack.Screen name="chapter" options={{ title: 'Intent' }} />
      <Stack.Screen name="evidence" options={{ title: 'Proof' }} />
      <Stack.Screen name="comments" options={{ title: 'Comments' }} />
      <Stack.Screen name="comment" options={{ ...FORM_SHEET, title: 'Comment' }} />
      <Stack.Screen name="card" options={{ ...FORM_SHEET, title: 'Card' }} />
    </Stack>
  )
}

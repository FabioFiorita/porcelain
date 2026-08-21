import { Stack } from 'expo-router/stack'

/**
 * A presented sheet, not a pushed screen — the same shape the Hub stack uses. `formSheet` is
 * `UISheetPresentationController` on iOS and a Material bottom sheet on Android: detents, a
 * grabber, drag-to-dismiss and keyboard avoidance all come from the platform. The presentation
 * is the platform's; everything drawn inside it is Porcelain's, including the sheet's own bar.
 *
 * Both Tasks sheets are forms, so they open nearly full height: a composer that starts at half
 * a screen puts its own fields under the keyboard.
 */
const SHEET = {
  headerShown: false,
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.85, 0.99],
  sheetCornerRadius: 20,
  sheetGrabberVisible: true,
}

/** Tasks is a tab root; see `terminals/_layout.tsx` for why a tab root needs its own stack. */
export default function TasksLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Each sheet draws its own `SheetBar` with the title and the action the draft it holds
          decides — Save and Add are disabled while a write is in flight, which no layout can
          know. */}
      <Stack.Screen name="new" options={SHEET} />
      <Stack.Screen name="[id]" options={SHEET} />
    </Stack>
  )
}

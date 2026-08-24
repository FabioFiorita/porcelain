import { Stack } from 'expo-router/stack'

/**
 * The Hub tab is one native stack: the Worktree list pushes a Worktree, and a Worktree pushes
 * its surfaces and their detail screens. Three nested stacks (Files, Changes, Terminal) used to
 * do this job because each surface was its own tab; one stack replaces them now that a surface
 * is a screen rather than a tab.
 *
 * Detail routes stay direct children of this group so their URLs are unchanged — `/file/…`,
 * `/folder/…`, `/changes/file/…` — and every `router.push` in the feature panels keeps working.
 *
 * **No screen here wears a native bar.** Every one of them draws `ScreenHeader` from
 * `panel-chrome` instead, so this layout has no titles and no `headerRight` to declare — only
 * which routes are presented rather than pushed. `UINavigationBar` gave the app the system's
 * type, its blur, its large-title collapse and its tint, over a product whose every other pixel
 * is a `@porcelain/ui` token; the seam is what this pass removes. What the native bar did for
 * free and now has to be drawn — the back chevron, the safe-area inset, title truncation, the
 * action cluster — is `ScreenHeader`'s job, in ONE component rather than the five hand-rolled
 * copies that preceded the native bar.
 */

/**
 * A presented sheet, not a pushed screen: the quick-open palette and the surface companion.
 *
 * `formSheet` is `UISheetPresentationController` on iOS and a Material bottom sheet on Android
 * — detents, a grabber and drag-to-dismiss, which no `Modal` reimplementation gets right. The
 * presentation is the platform's; the bar inside it is `SheetBar`, ours, on both platforms.
 */
const SHEET = {
  presentation: 'formSheet' as const,
  // Half height to start — enough list to read without covering the screen it was opened from
  // — and near-full for when the answer is further down.
  sheetAllowedDetents: [0.6, 0.95],
  sheetCornerRadius: 20,
  sheetGrabberVisible: true,
}

export default function HubLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* A form, not a list: at 0.6 the fields sit under the keyboard, so this sheet
          starts near-full instead of taking SHEET's list detents. */}
      <Stack.Screen name="new-worktree" options={{ ...SHEET, sheetAllowedDetents: [0.85, 0.99] }} />

      <Stack.Screen name="quick-open" options={SHEET} />
      <Stack.Screen name="companion" options={SHEET} />
    </Stack>
  )
}

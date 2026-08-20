import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'

import { shellSheetHref } from './shell-sheets'
import type { SurfaceId } from './surfaces'

/**
 * One item in a native header's right-hand cluster.
 *
 * Deliberately a bare glyph on a touch target and nothing else. The bar these replace drew a
 * 40pt bordered chip per action because it was a `View` pretending to be a toolbar, and a
 * pretend toolbar has to draw its own affordance. `UINavigationBar` and the Material app bar
 * draw the affordance themselves, so a second border here reads as a button inside a button.
 */
function HeaderItem({
  accessibilityLabel,
  glyph,
  testID,
  onPress,
}: {
  accessibilityLabel: string
  glyph: ChromeIconName
  testID: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="min-h-11 min-w-9 items-center justify-center active:opacity-50"
      hitSlop={8}
      testID={testID}
      onPress={onPress}
    >
      <ChromeGlyph name={glyph} size={19} tone="foreground" />
    </Pressable>
  )
}

/**
 * The Hub stack's header actions: quick open, and the surface companion.
 *
 * These were the two buttons the hand-rolled `PhoneHeader` drew inside its own title band.
 * They are now `headerRight` items on the native bar, so they scroll, blur and collapse with
 * it instead of sitting on a `View` that had to reimplement all three.
 *
 * The companion carries its surface in the URL rather than writing `activeSurface` to the
 * shell store on the way. The sheet is a route now; a route that needs to know which surface
 * it is showing should say so in its own address, not depend on a store write that happened
 * one frame earlier.
 */
export function HeaderActions({
  companionSurface,
  search = true,
}: {
  companionSurface?: SurfaceId
  /** The Worktree screen drops it — it is a list of surfaces, not a place to search from. */
  search?: boolean
}): React.JSX.Element {
  const router = useRouter()

  return (
    <View className="flex-row items-center gap-1">
      {search ? (
        <HeaderItem
          accessibilityLabel="Quick open"
          glyph="search"
          testID="porcelain-header-search"
          onPress={() => {
            router.push(shellSheetHref('search'))
          }}
        />
      ) : null}
      {companionSurface === undefined ? null : (
        <HeaderItem
          accessibilityLabel="Companion"
          glyph="companion"
          testID="porcelain-header-companion"
          onPress={() => {
            router.push({ params: { surface: companionSurface }, pathname: '/companion' })
          }}
        />
      )}
    </View>
  )
}

/**
 * The dismiss item on a screen presented as a `fullScreenModal`.
 *
 * A modal is the root of its own presented stack, so the bar draws no back button, and a
 * full-screen presentation has no swipe-down either. Without this the screen is a dead end on
 * iOS — Android would still leave by the hardware back button, which is exactly the kind of
 * "works on my emulator" trap a bar with no visible exit sets.
 */
export function HeaderCloseButton({ testID }: { testID: string }): React.JSX.Element {
  const router = useRouter()

  return (
    <HeaderItem
      accessibilityLabel="Close"
      glyph="close"
      testID={testID}
      onPress={() => {
        router.back()
      }}
    />
  )
}

/**
 * The dismiss item on a presented sheet's own native bar.
 *
 * A `formSheet` already dismisses on swipe-down, but a sheet that only closes by gesture has no
 * visible way out — the same reason the pushed screens keep a back button they could also swipe.
 */
export function HeaderDoneButton({ testID }: { testID: string }): React.JSX.Element {
  const router = useRouter()

  return (
    <Pressable
      accessibilityLabel="Done"
      accessibilityRole="button"
      className="min-h-11 justify-center px-1 active:opacity-50"
      hitSlop={8}
      testID={testID}
      onPress={() => {
        router.back()
      }}
    >
      <Text className="text-base font-semibold text-primary">Done</Text>
    </Pressable>
  )
}

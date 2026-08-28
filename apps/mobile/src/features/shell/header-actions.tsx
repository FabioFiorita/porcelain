import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph, type ChromeIconName } from '@/components/chrome-glyph'

import { shellSheetHref } from './shell-sheets'
import { useShellStore } from './shell-store'
import { useIsTablet } from './use-app-window'

/**
 * One item in a header's right-hand cluster.
 *
 * Deliberately a bare glyph on a touch target and nothing else — the web client's header
 * buttons are `variant="ghost"` for the same reason. An earlier bar drew a 40pt bordered chip
 * per action, and a border around every glyph reads as a button inside a button.
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
 * The Hub stack's header action for Quick Open.
 */
export function HeaderActions({
  search = true,
}: {
  /** Screens with nothing to open from — a presented sheet, a modal root — pass false. */
  search?: boolean
}): React.JSX.Element {
  const router = useRouter()
  const tablet = useIsTablet()
  const openQuickOpen = useShellStore((state) => state.openQuickOpen)

  return (
    <View className="flex-row items-center gap-1">
      {search ? (
        <HeaderItem
          accessibilityLabel="Quick open"
          glyph="search"
          testID="porcelain-header-search"
          onPress={() => {
            if (tablet) openQuickOpen()
            else router.push(shellSheetHref('search'))
          }}
        />
      ) : null}
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

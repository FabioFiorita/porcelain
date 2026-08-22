import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/**
 * A presented sheet's own title and primary action.
 *
 * This used to be Android-only, and the asymmetry was the tell. `formSheet` is
 * `UISheetPresentationController` on iOS, where the native stack draws a `UINavigationBar`
 * inside the sheet and a `headerRight` lands on it; the same presentation on Android is a
 * Material bottom sheet with NO app bar, so `react-native-screens` drew nothing and every
 * `headerRight` was silently dropped — New Task presented as a form you could fill in and had
 * no way to submit. One sheet therefore wore the system's bar and the other wore ours.
 *
 * Now neither does. The sheet draws its own bar on both platforms, in the same 48pt band with
 * the same hairline as `ScreenHeader`, so a sheet reads as part of the app that opened it.
 */
export function SheetBar({
  action,
  title,
}: {
  /** The sheet's primary action — the same element the screen gives `headerRight` for iOS. */
  action?: React.ReactNode
  title: string
}): React.JSX.Element {
  return (
    <View
      // No status-bar inset: a sheet is inset from the top of the window and the grabber sits
      // above this band. `ScreenHeader`'s geometry otherwise, so the two read as one bar.
      className="h-12 flex-row items-center gap-1 border-b border-border bg-background px-4"
      // `react-native-screens` wants a `formSheet` holding a ScrollView to be exactly two
      // native subviews — this bar, then the scroll body — so it can keep the bar fixed and
      // the body alone scrolling. View-flattening erases this row from the native tree since
      // it is a plain box with no properties of its own, so the sheet saw five flattened
      // subviews instead of two and laid the body over the bar rather than under it. RNScreens
      // logs exactly this ("FormSheet with ScrollView expects at most 2 subviews... apply
      // collapsable: false on your header"); `collapsable={false}` keeps this box in the tree.
      collapsable={false}
      testID="porcelain-sheet-bar"
    >
      <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {action === undefined ? null : <View className="-mr-2 flex-row items-center">{action}</View>}
    </View>
  )
}

/** A word in a sheet's bar: the shape both the native `headerRight` and `SheetBar` render. */
export function SheetAction({
  disabled = false,
  label,
  onPress,
  testID,
}: {
  disabled?: boolean
  label: string
  onPress: () => void
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn('min-h-11 justify-center px-1 active:opacity-50', disabled && 'opacity-40')}
      disabled={disabled}
      hitSlop={8}
      testID={testID}
      onPress={onPress}
    >
      <Text className="text-base font-semibold text-primary">{label}</Text>
    </Pressable>
  )
}

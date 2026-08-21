import { Platform, Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/**
 * A presented sheet's own title and primary action, for the platform that draws neither.
 *
 * `formSheet` is `UISheetPresentationController` on iOS, and the native stack draws its bar
 * inside the sheet — the title and `headerRight` land where you expect them. On Android the same
 * presentation is a Material bottom sheet with NO app bar: `react-native-screens` renders no
 * header for it, `headerShown: true` does not bring one back, and every `headerRight` a sheet
 * declares is silently dropped. Observed on an emulator, where New Task and New Worktree both
 * presented as forms you could fill in and had no way to submit.
 *
 * So this is Android-only by construction. It is not a second design — it is the same title and
 * the same action, drawn by the sheet because nothing else will draw them. If a future
 * `react-native-screens` gives the Android sheet a real header, deleting the `Platform` guard is
 * the whole change.
 */
export function SheetBar({
  action,
  title,
}: {
  /** The sheet's primary action — the same element the screen gives `headerRight` for iOS. */
  action?: React.ReactNode
  title: string
}): React.JSX.Element | null {
  if (Platform.OS !== 'android') return null

  return (
    <View
      className="min-h-14 flex-row items-center justify-between border-b border-border px-4"
      testID="porcelain-sheet-bar"
    >
      <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
        {title}
      </Text>
      {action ?? null}
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

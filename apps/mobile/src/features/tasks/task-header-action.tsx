import { Pressable } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

/**
 * A word in a presented sheet's native bar — Save, Add.
 *
 * `HeaderDoneButton` in `features/shell/header-actions` is the same shape for the sheets that
 * only dismiss; these commit a write first, so they carry their own label and a disabled state
 * held while the write is in flight. A second tap on a pending Save is a duplicate Task.
 */
export function TaskHeaderAction({
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

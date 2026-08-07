import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Option<T extends string> = {
  value: T
  label: string
  testID?: string
  /**
   * This segment alone is unselectable — a sub-tab with nothing behind it. It stays
   * visible and dimmed rather than disappearing, so the shape of what you are
   * looking at is legible before you tap.
   */
  disabled?: boolean
}

/**
 * Single-select segmented control for Settings rows.
 * Built with Pressable (not ToggleGroup) so labels always paint on native —
 * RN Reusables ToggleGroup + TextClassContext was leaving blank chips.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  disabled = false,
  testID,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  className?: string
  /** Held while a write is in flight, so a second tap cannot race the first. */
  disabled?: boolean
  testID?: string
}): React.JSX.Element {
  return (
    <View
      accessibilityRole="tablist"
      className={cn(
        'w-full flex-row rounded-lg bg-muted p-0.5',
        disabled && 'opacity-60',
        className,
      )}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value
        const off = disabled || option.disabled === true
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ disabled: off, selected }}
            className={cn(
              'min-h-8 min-w-0 flex-1 items-center justify-center rounded-md px-2.5 py-1.5',
              selected && 'bg-background shadow-sm shadow-black/5',
              option.disabled === true && 'opacity-40',
            )}
            disabled={off}
            testID={option.testID}
            onPress={() => {
              onChange(option.value)
            }}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                selected ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Option<T extends string> = {
  value: T
  label: string
  testID?: string
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
  testID,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  className?: string
  testID?: string
}): React.JSX.Element {
  return (
    <View
      accessibilityRole="tablist"
      className={cn('w-full flex-row rounded-lg bg-muted p-0.5', className)}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className={cn(
              'min-h-8 min-w-0 flex-1 items-center justify-center rounded-md px-2.5 py-1.5',
              selected && 'bg-background shadow-sm shadow-black/5',
            )}
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

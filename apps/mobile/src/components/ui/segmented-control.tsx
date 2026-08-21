import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Option<T extends string> = {
  value: T
  label: string
  /** Addresses one segment — in a test, and to a human driving the simulator. */
  testID?: string
}

/**
 * The scope switcher: Changes' working-tree/branch, Files' tree/search, Settings' sections, and
 * every enumerated preference in General.
 *
 * It was `@expo/ui`'s `SegmentedControl` — `UISegmentedControl` on iOS, a Material
 * `SingleChoiceSegmentedButtonRow` on Android — on the reasoning that a switcher is chrome and
 * chrome should come from the platform. It is the reasoning this whole pass reverses: a native
 * control is drawn by UIKit from the system's palette and type, so it cannot be told about
 * `--muted` or `--radius`, and six of these sitting inside Porcelain's own cards was the single
 * loudest place the app stopped looking like itself.
 *
 * This is the web client's `ToggleGroup`, in the same geometry: `rounded-2xl` segments in a
 * gapped row, the selected one filled with `bg-muted`, the rest transparent. Every value is a
 * token, so it follows the app's theme — including the human who pins Porcelain to dark on a
 * light phone, which the native control never did.
 *
 * Selection travels by VALUE again. The native controls handed back a segment index, and the
 * index had to be mapped back through the options on every change; a `Pressable` per segment
 * knows which option it is.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  testID,
}: {
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  /** Held while a write is in flight, so a second tap cannot race the first. */
  disabled?: boolean
  testID?: string
}): React.JSX.Element {
  // Four segments of `text-sm` do not fit a phone's width — Settings' own sections proved it by
  // truncating "Companion" — so a crowded group drops a rung rather than losing its words.
  const dense = options.length > 3

  return (
    <View
      accessibilityRole="tablist"
      className={cn('flex-row items-center gap-2', disabled && 'opacity-40')}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ disabled, selected }}
            className={cn(
              'min-h-9 min-w-0 flex-1 items-center justify-center rounded-2xl',
              dense ? 'px-1.5' : 'px-2.5',
              selected ? 'bg-muted' : 'active:bg-muted/50',
            )}
            disabled={disabled}
            testID={option.testID}
            onPress={() => {
              if (option.value !== value) onChange(option.value)
            }}
          >
            <Text
              className={cn(
                'font-medium',
                dense ? 'text-xs' : 'text-sm',
                selected ? 'text-foreground' : 'text-muted-foreground',
              )}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

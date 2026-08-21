import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type Option<T extends string> = {
  value: T
  label: string
  /** A second line under the label — what the desktop Settings list prints under each section. */
  detail?: string
  testID?: string
}

/**
 * Choose one of many: the web client's `Select`, as a trigger row over a sheet of options.
 *
 * A `SegmentedControl` divides the width by the number of options, so it is honest up to three
 * or four and starts eating words after that — Settings' own sections proved it by rendering
 * "Compani…". A select spends the same 36pt row on the CURRENT value at full length and puts
 * the rest in a sheet, which is what makes it the right control for a list that grows: the
 * Environments picker this app is going to need has as many options as the human has machines.
 *
 * The trigger is the web `SelectTrigger`'s geometry — a bordered `rounded-md` row with the value
 * and a chevron. The options are a sheet rather than a popover because a phone has no room to
 * float a menu next to its trigger, and the sheet's contents are Porcelain's: this is not a
 * `UIPickerView`, which would bring the system's wheel, type and fill back onto the screen.
 */
export function Select<T extends string>({
  disabled = false,
  onChange,
  options,
  testID,
  title,
  value,
}: {
  disabled?: boolean
  onChange: (value: T) => void
  options: readonly Option<T>[]
  testID: string
  /** Heading over the option sheet — what the human is choosing. */
  title: string
  value: T
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <>
      <Pressable
        accessibilityLabel={`${title}: ${selected?.label ?? value}`}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        className={cn(
          'min-h-9 flex-row items-center gap-2 rounded-md border border-input px-3 active:bg-accent',
          disabled && 'opacity-40',
        )}
        disabled={disabled}
        testID={testID}
        onPress={() => {
          setOpen(true)
        }}
      >
        <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
          {selected?.label ?? value}
        </Text>
        <ChromeGlyph name="chevron" size={12} tone="muted" />
      </Pressable>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      >
        <View className="gap-1 border-b border-border px-5 pb-3">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View className="gap-0.5 px-2" testID={`${testID}-options`}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent"
              testID={option.testID}
              onPress={() => {
                setOpen(false)
                if (option.value !== value) onChange(option.value)
              }}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-foreground">{option.label}</Text>
                {option.detail === undefined ? null : (
                  <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                    {option.detail}
                  </Text>
                )}
              </View>
              {option.value === value ? (
                <ChromeGlyph name="check" size={15} tone="primary" />
              ) : null}
            </Pressable>
          ))}
        </View>
      </Sheet>
    </>
  )
}

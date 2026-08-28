import { UPSTREAM_COMPARE_BASE } from '@porcelain/contracts/git'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Sheet } from '@/components/ui/sheet'
import { Text } from '@/components/ui/text'
import { branchLabel, useGitWorkspace } from '@/features/git'

type BaseOption = { value: string; label: string; detail: string }

/** Mobile counterpart of the web Changes comparison-base picker. */
export function ChangesBasePicker({
  active,
  defaultBase,
  onSelect,
  requested,
  selected,
}: {
  active: boolean
  defaultBase: string | undefined
  onSelect: (base: string | null) => void
  requested: string | undefined
  selected: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const workspace = useGitWorkspace({ enabled: active && open, placeholderData: true })
  const defaultValue = defaultBase ?? selected
  const activeValue = requested ?? defaultValue
  const options = useMemo(() => {
    const seen = new Set([defaultValue, UPSTREAM_COMPARE_BASE])
    const result: BaseOption[] = [
      { value: defaultValue, label: defaultValue, detail: 'Default' },
      { value: UPSTREAM_COMPARE_BASE, label: 'Upstream', detail: 'This branch’s remote' },
    ]
    for (const branch of workspace.branches.data ?? []) {
      const value = branchLabel(branch)
      if (seen.has(value)) continue
      seen.add(value)
      result.push({
        value,
        label: value,
        detail: branch.remote === null ? 'Local branch' : 'Remote branch',
      })
    }
    return result
  }, [defaultValue, workspace.branches.data])

  return (
    <>
      <Pressable
        accessibilityLabel={`Comparison base: ${selected}`}
        accessibilityRole="button"
        className="min-w-0 rounded-md px-1 py-1 active:bg-accent"
        testID="porcelain-changes-base-picker"
        onPress={() => {
          setOpen(true)
        }}
      >
        <Text className="max-w-36 font-mono text-xs text-muted-foreground" numberOfLines={1}>
          vs {selected}
        </Text>
      </Pressable>
      <Sheet
        open={open}
        scrollable
        testID="porcelain-changes-base-sheet"
        title="Compare against"
        onClose={() => {
          setOpen(false)
        }}
      >
        <ScrollView className="min-h-0 flex-1 px-2" contentContainerClassName="gap-0.5">
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === activeValue }}
              className="min-h-12 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-accent"
              testID={`porcelain-changes-base-${encodeURIComponent(option.value)}`}
              onPress={() => {
                setOpen(false)
                onSelect(option.value === defaultValue ? null : option.value)
              }}
            >
              <View className="min-w-0 flex-1">
                <Text className="font-mono text-sm font-medium text-foreground" numberOfLines={1}>
                  {option.label}
                </Text>
                <Text className="text-xs text-muted-foreground">{option.detail}</Text>
              </View>
              {option.value === activeValue ? (
                <ChromeGlyph name="check" size={15} tone="primary" />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  )
}

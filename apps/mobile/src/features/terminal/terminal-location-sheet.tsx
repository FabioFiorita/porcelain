import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { NativeSheet } from '@/components/native/native-sheet'
import { EmptyNote } from '@/components/surface-chrome'
import { SURFACE_ROW } from '@/components/surface-layout'
import { cn } from '@/lib/utils'

import type { NewTerminalOption } from './terminals-board-model'

/**
 * Where the new shell should run.
 *
 * A `cwd` is required by the create frame, so this is not a detail the phone can defer: the
 * picker is the whole "New terminal" gesture rather than a second step after one appears. It
 * is a component sheet rather than a route because it belongs to the list behind it — the same
 * split `native-sheet.tsx` draws between a control and a destination.
 */
export function TerminalLocationSheet({
  onClose,
  onPick,
  open,
  options,
}: {
  onClose: () => void
  onPick: (option: NewTerminalOption) => void
  open: boolean
  options: readonly NewTerminalOption[]
}): React.JSX.Element {
  return (
    <NativeSheet
      description="The shell starts in the directory you pick."
      open={open}
      snapPoints={['55%']}
      title="New terminal"
      onClose={onClose}
    >
      <View className="flex-1" testID="porcelain-terminals-location-sheet">
        {options.length === 0 ? (
          <EmptyNote
            body="Pair an environment and open a project — a shell needs somewhere to run."
            testID="porcelain-terminals-location-empty"
            title="Nowhere to run"
          />
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="gap-1 pb-4">
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityLabel={
                  option.detail === null ? option.label : `${option.label}, ${option.detail}`
                }
                accessibilityRole="button"
                className={cn('min-h-12 flex-row items-center gap-2.5 py-2.5', SURFACE_ROW)}
                testID={`porcelain-terminals-location-${option.key}`}
                onPress={() => {
                  onPick(option)
                }}
              >
                <ChromeGlyph
                  name={option.detail === null ? 'desktop' : 'branch'}
                  size={16}
                  tone="muted"
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                    {option.label}
                  </Text>
                  <Text
                    className="font-mono text-3xs text-muted-foreground"
                    ellipsizeMode="head"
                    numberOfLines={1}
                  >
                    {option.detail ?? option.path}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </NativeSheet>
  )
}

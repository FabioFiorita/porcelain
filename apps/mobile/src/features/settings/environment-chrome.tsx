import { Pressable, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { PanelLabel } from '@/components/panel-chrome'
import { Text } from '@/components/ui/text'

/**
 * The three pieces the environments screens share. Settings is inside a sheet on tablet and a
 * tab on phone, so these screens push each other rather than the navigator — `BackRow` is that
 * step, not a `ScreenHeader`.
 */

export function BackRow({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      className="-ml-1 flex-row items-center gap-0.5 self-start py-1 active:opacity-70"
      testID="porcelain-settings-env-back"
      onPress={onPress}
    >
      <ChromeGlyph name="chevronLeft" size={16} tone="primary" />
      <Text className="text-sm font-medium text-primary">{label}</Text>
    </Pressable>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      {children}
    </View>
  )
}

export function Meta({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="gap-0.5">
      <PanelLabel>{label}</PanelLabel>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  )
}

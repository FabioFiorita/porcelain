import { View } from 'react-native'

import { Text } from '@/components/ui/text'

/** Label + description stacked above the control — phone width is too tight for side-by-side. */
export function PreferenceRow({
  label,
  description,
  children,
  testID,
}: {
  label: string
  description: string
  children: React.ReactNode
  testID?: string
}): React.JSX.Element {
  return (
    <View className="w-full gap-2" testID={testID}>
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        <Text className="text-xs leading-4 text-muted-foreground">{description}</Text>
      </View>
      <View className="w-full">{children}</View>
    </View>
  )
}

import { BlurView } from 'expo-blur'
import type { GestureResponderEvent } from 'react-native'
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native'

type ModalBackdropProps = {
  accessibilityElementsHidden?: boolean
  accessibilityLabel?: string
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants'
  onPress?: (event: GestureResponderEvent) => void
  testID?: string
}

/** Shared native scrim and blur for every mobile modal surface. */
export function ModalBackdrop({
  accessibilityElementsHidden,
  accessibilityLabel,
  importantForAccessibility,
  onPress,
  testID,
}: ModalBackdropProps): React.JSX.Element {
  const tint = useColorScheme() === 'dark' ? 'dark' : 'light'
  const dismissible = onPress !== undefined
  return (
    <View className="absolute inset-0" pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <BlurView intensity={36} pointerEvents="none" style={StyleSheet.absoluteFill} tint={tint} />
      <View className="absolute inset-0 bg-black opacity-50" pointerEvents="none" />
      <Pressable
        accessibilityElementsHidden={accessibilityElementsHidden}
        accessibilityLabel={dismissible ? (accessibilityLabel ?? 'Dismiss') : undefined}
        accessibilityRole={dismissible ? 'button' : undefined}
        className="absolute inset-0"
        importantForAccessibility={importantForAccessibility}
        onPress={onPress}
        testID={testID}
      />
    </View>
  )
}

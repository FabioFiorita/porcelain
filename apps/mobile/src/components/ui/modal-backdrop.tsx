import { requireOptionalNativeModule } from 'expo'
import type { GestureResponderEvent } from 'react-native'
import { Platform, Pressable, StyleSheet, UIManager, useColorScheme, View } from 'react-native'

type ModalBackdropProps = {
  accessibilityElementsHidden?: boolean
  accessibilityLabel?: string
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants'
  onPress?: (event: GestureResponderEvent) => void
  testID?: string
}

type BlurViewComponent = typeof import('expo-blur').BlurView

function resolveBlurView(): BlurViewComponent | null {
  // Keep an older installed development client usable until it is rebuilt with expo-blur.
  // The JS package can be present while the native ExpoBlurView manager is absent.
  if (
    Platform.OS !== 'web' &&
    (requireOptionalNativeModule('ExpoBlur') === null ||
      UIManager.getViewManagerConfig('ExpoBlurView') === null)
  ) {
    return null
  }

  return require('expo-blur').BlurView as BlurViewComponent
}

const BlurView = resolveBlurView()

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
      {BlurView ? (
        <BlurView intensity={36} pointerEvents="none" style={StyleSheet.absoluteFill} tint={tint} />
      ) : null}
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

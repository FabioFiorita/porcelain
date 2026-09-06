import * as DialogPrimitive from '@rn-primitives/dialog'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { useIsTablet } from '@/features/shell/use-app-window'
import { Sheet } from './sheet'
import { Text } from './text'

const SCRIM = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
} as const

/** Centered workspace dialogs on tablets; compact bottom sheets on phones. */
export function AdaptiveDialog(props: {
  children: React.ReactNode
  description?: string
  onClose: () => void
  open: boolean
  scrollable?: boolean
  testID?: string
  title?: string
}): React.JSX.Element {
  const tablet = useIsTablet()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  if (!tablet) return <Sheet {...props} />
  const { children, description, onClose, open, scrollable, testID, title } = props
  const maxHeight = Math.max(120, height - insets.top - insets.bottom - 48)
  const body = <View className="pb-5">{children}</View>
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <Pressable style={SCRIM} testID={testID ? `${testID}-backdrop` : undefined}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              className="flex-1 items-center justify-center"
              pointerEvents="box-none"
              style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
            >
              <DialogPrimitive.Content asChild>
                <View
                  className="overflow-hidden rounded-xl border border-border bg-card"
                  style={{
                    width: Math.min(520, width - insets.left - insets.right - 48),
                    maxHeight,
                    ...(scrollable ? { height: Math.min(560, maxHeight) } : {}),
                  }}
                  onTouchEnd={(event) => event.stopPropagation()}
                  testID={testID}
                >
                  <View className="flex-row items-start gap-3 px-5 pt-5 pb-3">
                    <View className="min-w-0 flex-1 gap-1">
                      {title && (
                        <Text className="text-base font-semibold text-foreground">{title}</Text>
                      )}
                      {description && (
                        <Text className="text-sm text-muted-foreground">{description}</Text>
                      )}
                    </View>
                    <Pressable
                      accessibilityLabel="Close dialog"
                      accessibilityRole="button"
                      onPress={onClose}
                      testID={testID ? `${testID}-close` : undefined}
                      className="size-8 items-center justify-center rounded-lg active:bg-accent"
                    >
                      <ChromeGlyph name="close" size={16} />
                    </Pressable>
                  </View>
                  {scrollable ? (
                    <View className="min-h-0 flex-1 pb-5">{children}</View>
                  ) : (
                    <ScrollView
                      bounces={false}
                      keyboardShouldPersistTaps="handled"
                      style={{ flexShrink: 1 }}
                    >
                      {body}
                    </ScrollView>
                  )}
                </View>
              </DialogPrimitive.Content>
            </KeyboardAvoidingView>
          </Pressable>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

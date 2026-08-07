import { SymbolView } from 'expo-symbols'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ModalBackdrop } from '@/components/ui/modal-backdrop'
import { cn } from '@/lib/utils'

type ShellModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** Hide title band (command palette). */
  hideHeader?: boolean
  children: React.ReactNode
  /** Outer panel style — width / maxHeight etc. */
  contentStyle?: ViewStyle
  /** Zero padding for command-style layouts. */
  bare?: boolean
}

/**
 * Reliable tablet overlay using RN Modal (not rn-primitives Dialog).
 * SplitView + FullWindowOverlay was silently failing to present search/project sheets.
 */
export function ShellModal({
  open,
  onClose,
  title,
  description,
  hideHeader,
  children,
  contentStyle,
  bare,
}: ShellModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const closeTint = scheme === 'dark' ? '#F5F7FA' : '#171A1C'

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={open}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="absolute inset-0 items-center justify-center"
      >
        <ModalBackdrop
          accessibilityLabel="Dismiss"
          onPress={onClose}
          testID="porcelain-modal-backdrop"
        />
        <View
          className={cn(
            'mx-4 max-w-full overflow-hidden rounded-2xl border border-border bg-background shadow-lg',
            !bare && 'gap-3 p-5',
          )}
          style={[
            {
              marginTop: insets.top + 8,
              marginBottom: insets.bottom + 8,
            },
            contentStyle,
          ]}
        >
          {!hideHeader && title ? (
            <View className={cn('gap-1 pr-9', bare && 'px-5 pt-5')}>
              <Text className="text-lg font-semibold text-foreground">{title}</Text>
              {description ? (
                <Text className="text-sm text-muted-foreground">{description}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            className="absolute right-3.5 top-3.5 z-[2] p-1"
            hitSlop={12}
            onPress={onClose}
          >
            <SymbolView
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              name={{ android: 'close', ios: 'xmark' }}
              size={16}
              tintColor={closeTint}
              weight="medium"
            />
          </Pressable>

          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/**
 * Panel geometry for a standard sheet. Read live (not `Dimensions.get` at module scope):
 * frozen portrait metrics starve a landscape iPad dialog of the width its controls need.
 */
export function useShellModalSize(): { width: number; maxHeight: number } {
  const { width, height } = useWindowDimensions()
  const isPhoneWidth = width < 768
  return {
    maxHeight: isPhoneWidth ? Math.min(height * 0.78, 640) : Math.min(height * 0.72, 520),
    width: isPhoneWidth ? Math.min(width - 24, 400) : Math.min(width * 0.55, 440),
  }
}

export function ShellModalScroll({
  children,
  className,
  contentContainerClassName,
  style,
  testID,
}: {
  children: React.ReactNode
  className?: string
  contentContainerClassName?: string
  style?: ViewStyle
  testID?: string
}): React.JSX.Element {
  return (
    <ScrollView
      className={className}
      contentContainerClassName={cn('grow gap-3 pb-1', contentContainerClassName)}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
      style={style}
      testID={testID}
    >
      {children}
    </ScrollView>
  )
}

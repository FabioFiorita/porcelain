import { SymbolView } from 'expo-symbols'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cn } from '@/lib/utils'

const SCRIM = 'rgba(0, 0, 0, 0.48)'

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
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Pressable
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
        />
        <View
          className={cn(
            'overflow-hidden rounded-2xl border border-border bg-background shadow-lg',
            !bare && 'gap-3 p-5',
          )}
          style={[
            {
              marginHorizontal: 16,
              marginTop: insets.top + 8,
              marginBottom: insets.bottom + 8,
              maxWidth: '100%',
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
            hitSlop={12}
            onPress={onClose}
            style={{ position: 'absolute', right: 14, top: 14, zIndex: 2, padding: 4 }}
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
      </View>
    </Modal>
  )
}

export function ShellModalScroll({
  children,
  style,
  testID,
}: {
  children: React.ReactNode
  style?: ViewStyle
  testID?: string
}): React.JSX.Element {
  return (
    <ScrollView
      contentContainerStyle={{ gap: 12, paddingBottom: 4, flexGrow: 1 }}
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

import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { TerminalList } from './terminal-list'

/**
 * The Terminal surface on phone: the roster. Its title and toolbar are screen options on the
 * Hub stack, drawn by the native bar.
 *
 * Opening a session pushes a route rather than swapping the viewer behind a store flag, which
 * is what hands the interactive pop gesture, the Android back button and re-tap-to-root back
 * to the navigator — the same split Changes uses. The tablet keeps the store-driven selection
 * its SplitView column needs.
 */
export function TerminalPhoneScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()

  return (
    <View className="flex-1 bg-background" testID="porcelain-phone-surface-terminal">
      <TerminalList
        active={focused}
        onOpenSession={(id) => {
          router.push({ params: { id }, pathname: '/terminal/[id]' })
        }}
      />
    </View>
  )
}

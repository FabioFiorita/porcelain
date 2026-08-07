import { useIsFocused, useRouter } from 'expo-router'
import { View } from 'react-native'

import { PhoneHeader } from '@/features/shell/phone-header'

import { TerminalList } from './terminal-list'

/**
 * The Terminal tab root on phone: the header and the roster.
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
      <PhoneHeader companionSurface="terminal" title="Terminal" />
      <TerminalList
        active={focused}
        onOpenSession={(id) => {
          router.push({ params: { id }, pathname: '/terminal/[id]' })
        }}
      />
    </View>
  )
}

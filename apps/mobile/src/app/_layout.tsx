import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { BoardNotificationBridge } from '@/features/board'
import { ReviewCommentNotificationBridge } from '@/features/comments'
import { FilesNotificationBridge } from '@/features/files'
import { GitNotificationBridge } from '@/features/git'
import { AppThemeProvider, useResolvedColorScheme } from '@/features/settings/theme-provider'
import { PhoneBottomChrome } from '@/features/shell/bottom-chrome'
import { PhoneShell } from '@/features/shell/phone-shell'
import { TabletShell } from '@/features/shell/tablet-shell'
import { useIsTablet } from '@/features/shell/use-app-window'
import { DaemonProvider } from '@/lib/daemon/provider'

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaProvider>
        <AppThemeProvider>
          <ThemedApp />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function ThemedApp(): React.JSX.Element {
  const colorScheme = useResolvedColorScheme()
  const isTablet = useIsTablet()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DaemonProvider>
        <BoardNotificationBridge />
        <ReviewCommentNotificationBridge />
        <FilesNotificationBridge />
        <GitNotificationBridge />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        {/* Only the phone floats chrome over its content. A tablet column ends above its own
            chrome already, so it declares none and every shared body reads zero there. */}
        {isTablet ? (
          <TabletShell />
        ) : (
          <PhoneBottomChrome>
            <PhoneShell />
          </PhoneBottomChrome>
        )}
        <PortalHost />
      </DaemonProvider>
    </ThemeProvider>
  )
}

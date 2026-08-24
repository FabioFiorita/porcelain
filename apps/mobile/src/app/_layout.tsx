import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ActionsNotificationBridge } from '@/features/actions'
import { FilesNotificationBridge } from '@/features/files'
import { GitNotificationBridge } from '@/features/git'
import { ProjectDataFreshnessBridge } from '@/features/project-data'
import { SearchNotificationBridge } from '@/features/search'
import { AppThemeProvider, useResolvedColorScheme } from '@/features/settings/theme-provider'
import { PhoneShell } from '@/features/shell/phone-shell'
import { TabletShell } from '@/features/shell/tablet-shell'
import { useIsTablet } from '@/features/shell/use-app-window'
import { WorktreeResetBridge } from '@/features/shell/worktree-reset-bridge'
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
        <FilesNotificationBridge />
        <SearchNotificationBridge />
        <GitNotificationBridge />
        <ActionsNotificationBridge />
        <ProjectDataFreshnessBridge />
        <WorktreeResetBridge />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        {isTablet ? <TabletShell /> : <PhoneShell />}
        {/* The portal host has to FILL the window, and it does not by default: as a plain flex
            child next to a `flex-1` shell it lays out at zero height, and everything portalled
            into it — every sheet backdrop, every menu — positions itself against a box with no
            size. That is why a sheet rendered off the bottom edge with no dimming behind it.
            `box-none` so an empty host stays invisible to touches. */}
        <View className="absolute bottom-0 left-0 right-0 top-0" pointerEvents="box-none">
          <PortalHost />
        </View>
      </DaemonProvider>
    </ThemeProvider>
  )
}

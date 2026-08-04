import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform, useColorScheme, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { usePreferencesStore } from '@/features/settings/preferences-store'
import { PhoneShell } from '@/features/shell/phone-shell'
import { TabletShell } from '@/features/shell/tablet-shell'
import { DaemonProvider } from '@/lib/daemon/provider'

export default function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const { width, height } = useWindowDimensions()
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || Math.min(width, height) >= 768
  const hydratePreferences = usePreferencesStore((state) => state.hydrate)

  useEffect(() => {
    hydratePreferences()
  }, [hydratePreferences])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <DaemonProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            {isTablet ? <TabletShell /> : <PhoneShell />}
            <PortalHost />
          </DaemonProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { StatusBar } from 'expo-status-bar'
import { Platform, useColorScheme, useWindowDimensions } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { PocIPhoneEntryPoint } from '@/features/poc/poc-shell'
import { TabletShell } from '@/features/shell/tablet-shell'
import { DaemonProvider } from '@/lib/daemon/provider'

export default function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()
  const { width, height } = useWindowDimensions()
  const isTablet = (Platform.OS === 'ios' && Platform.isPad) || Math.min(width, height) >= 768

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <DaemonProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          {isTablet ? <TabletShell /> : <PocIPhoneEntryPoint />}
          <PortalHost />
        </DaemonProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

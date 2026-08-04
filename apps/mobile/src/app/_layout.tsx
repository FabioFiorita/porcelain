import '@/global.css'

import { PortalHost } from '@rn-primitives/portal'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { DaemonProvider } from '@/lib/daemon/provider'

export default function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <DaemonProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
          <PortalHost />
        </DaemonProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

import { ObserveRoot } from 'expo-observe'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { useColorScheme } from 'react-native'

function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            contentStyle: { backgroundColor: 'transparent' },
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1.0],
            sheetGrabberVisible: true,
          }}
        />
      </Stack>
    </ThemeProvider>
  )
}

// EAS Observe: measures time to first render for cold and warm launches. Deliberately WITHOUT
// `Observe.configure({ integrations: { 'expo-router': true } })` — per-route navigation metrics
// only surface in the Navigation events dashboard, which this account's plan does not include,
// so the integration would ship data nobody can read. Turn it on (module scope, before the first
// screen mounts) if the plan changes. The startup TTI each entry screen marks IS free-tier.
export default ObserveRoot.wrap(RootLayout)

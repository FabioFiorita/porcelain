import { ObserveRoot } from 'expo-observe'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { useColorScheme } from 'react-native'

/**
 * Every sheet in the app is the same form sheet — grabber, transparent content so the
 * sheet's own material shows through, and detents that leave the surface behind it visible.
 * Only the header differs, and each sheet owns that.
 */
const SHEET = {
  contentStyle: { backgroundColor: 'transparent' },
  presentation: 'formSheet',
  // Not `as const`: the native stack takes a mutable `number[]` here.
  sheetAllowedDetents: [0.7, 1.0] as number[],
  sheetGrabberVisible: true,
} as const

function RootLayout(): React.JSX.Element {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Settings nests a stack of its own, which supplies the header this one hides. */}
        <Stack.Screen name="settings" options={{ ...SHEET, headerShown: false }} />
        <Stack.Screen name="workspace" options={{ ...SHEET, title: 'Workspace' }} />
        <Stack.Screen name="companion" options={{ ...SHEET, title: 'Companion' }} />
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

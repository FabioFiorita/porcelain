import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation'
import { Stack } from 'expo-router/stack'
import { Platform, useColorScheme } from 'react-native'

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={
            Platform.OS === 'ios'
              ? {
                  contentStyle: { backgroundColor: 'transparent' },
                  headerShown: false,
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.7, 1.0],
                  sheetGrabberVisible: true,
                }
              : { headerShown: false, presentation: 'card' }
          }
        />
      </Stack>
    </ThemeProvider>
  )
}

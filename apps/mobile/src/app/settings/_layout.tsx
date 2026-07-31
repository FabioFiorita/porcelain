import { Stack } from 'expo-router/stack'

export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="environments" options={{ title: 'Environments' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  )
}

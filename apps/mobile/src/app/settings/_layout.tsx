import { Stack } from 'expo-router/stack'

export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="pair" options={{ title: 'Pair an environment group' }} />
    </Stack>
  )
}

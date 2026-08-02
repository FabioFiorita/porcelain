import { Stack } from 'expo-router/stack'

export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* The root draws the shared title; keep the route filename out of the native title slot. */}
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Settings' }} />
      <Stack.Screen name="pair" options={{ title: 'Pair an environment group' }} />
      <Stack.Screen name="environment/[id]" options={{ title: 'Environment' }} />
    </Stack>
  )
}

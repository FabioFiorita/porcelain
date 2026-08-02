import { Stack } from 'expo-router/stack'

export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      {/* The root draws the shared title and bolt toolbar itself. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="pair" options={{ title: 'Pair an environment group' }} />
      <Stack.Screen name="environment/[id]" options={{ title: 'Environment' }} />
    </Stack>
  )
}

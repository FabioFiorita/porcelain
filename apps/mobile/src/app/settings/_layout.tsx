import { Stack } from 'expo-router/stack'

/** Settings is chrome (form sheet from the root), never a bottom tab. */
export default function SettingsLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerTitle: '', title: 'Settings' }} />
      <Stack.Screen name="pair" options={{ title: 'Pair an environment group' }} />
      <Stack.Screen name="environment/[id]" options={{ title: 'Environment' }} />
    </Stack>
  )
}

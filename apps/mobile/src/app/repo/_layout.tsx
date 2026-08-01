import { Stack } from 'expo-router/stack'

export default function RepoLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Repo' }} />
      <Stack.Screen name="browse" options={{ title: 'Browse' }} />
    </Stack>
  )
}

import { Stack } from 'expo-router/stack'

const TITLES = {
  board: 'Board',
  changes: 'Changes',
  files: 'Files',
  review: 'Review',
  terminal: 'Terminal',
} as const

export default function TabStack({ segment }: { segment: string }) {
  const route = segment.slice(1, -1) as keyof typeof TITLES

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          title: TITLES[route],
        }}
      />
    </Stack>
  )
}

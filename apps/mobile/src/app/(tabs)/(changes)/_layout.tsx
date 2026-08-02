import { Stack } from 'expo-router/stack'

import { ChangesLayout as ChangesLayoutContainer } from '@/features/changes/changes-layout'

export default function ChangesLayout(): React.JSX.Element {
  return (
    <ChangesLayoutContainer>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        {/* `ScreenHeader` draws the title as a left header item; iOS always centres this one. */}
        <Stack.Screen name="index" options={{ headerTitle: '', title: 'Changes' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        <Stack.Screen name="reading" options={{ title: 'Read' }} />
        {/* `file` and `commit/[hash]` title themselves from their subject. */}
        <Stack.Screen name="file" />
        <Stack.Screen name="commit/[hash]" />
        <Stack.Screen
          name="actions"
          options={{
            contentStyle: { backgroundColor: 'transparent' },
            presentation: 'formSheet',
            sheetAllowedDetents: [0.7, 1.0] as number[],
            sheetGrabberVisible: true,
            title: 'Actions',
          }}
        />
      </Stack>
    </ChangesLayoutContainer>
  )
}

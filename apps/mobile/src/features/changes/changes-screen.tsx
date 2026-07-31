import { ObserveInteractiveMarker } from 'expo-observe'
import { router, Stack } from 'expo-router'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { toolbarIcon } from '@/components/toolbar-icon'

export function ChangesScreen(): React.JSX.Element {
  return (
    <>
      <PlaceholderScreen
        title="Changes"
        description="The working tree: what the agent touched, staged or not."
        details={[
          'Diffs per file with review-friendly grouping',
          'Staging and unstaging without leaving the diff',
          'Commit composer — the only commit UX in the app',
          'Commit history is pushed from this header',
        ]}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="History"
          icon={toolbarIcon('history')}
          onPress={(): void => router.push('/history')}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Settings"
          icon={toolbarIcon('settings')}
          onPress={(): void => router.push('/settings')}
        />
      </Stack.Toolbar>
      <ObserveInteractiveMarker />
    </>
  )
}

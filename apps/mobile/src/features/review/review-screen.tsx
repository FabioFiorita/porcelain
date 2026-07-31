import { ObserveInteractiveMarker } from 'expo-observe'
import { router, Stack } from 'expo-router'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { toolbarIcon } from '@/components/toolbar-icon'

export function ReviewScreen() {
  return (
    <>
      <PlaceholderScreen
        title="Review"
        description="Where agent work becomes trusted work: the Review canvas, read as a story."
        details={[
          'Intent — what the work was supposed to do',
          'Execution — what actually changed',
          'Evidence — the proof the loop was closed',
          'The Board is pushed from this header; a board card starts a review',
        ]}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Board"
          icon={toolbarIcon('board')}
          onPress={() => router.push('/board')}
        />
        <Stack.Toolbar.Button
          accessibilityLabel="Settings"
          icon={toolbarIcon('settings')}
          onPress={() => router.push('/settings')}
        />
      </Stack.Toolbar>
      <ObserveInteractiveMarker />
    </>
  )
}

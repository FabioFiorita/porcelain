import { ObserveInteractiveMarker } from 'expo-observe'
import { Stack } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function FilesScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="environment">
        <PlaceholderScreen
          description="The repository tree and file viewer, scoped to the daemon's checkout."
          details={[
            'Tree navigation with monorepo hide and pin',
            'Viewer for a single file, syntax-aware',
            'Search lives in this header — no separate Search tab on mobile',
          ]}
        />
      </DaemonGate>
      <Stack.SearchBar placeholder="Search files" />
      <ScreenHeader title="Files" />
      <ObserveInteractiveMarker />
    </>
  )
}

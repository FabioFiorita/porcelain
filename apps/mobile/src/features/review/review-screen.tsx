import { ObserveInteractiveMarker } from 'expo-observe'

import { DaemonGate } from '@/components/daemon-gate'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function ReviewScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="environment">
        <PlaceholderScreen
          description="Where agent work becomes trusted work: the Review canvas, read as a story."
          details={[
            'Intent — what the work was supposed to do',
            'Execution — what actually changed',
            'Evidence — the proof the loop was closed',
          ]}
        />
      </DaemonGate>
      <ScreenHeader title="Review" />
      <ObserveInteractiveMarker />
    </>
  )
}

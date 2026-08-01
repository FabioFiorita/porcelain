import { ObserveInteractiveMarker } from 'expo-observe'

import { DaemonGate } from '@/components/daemon-gate'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function BoardScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="environment">
        <PlaceholderScreen
          description="The plan the reviews are working through."
          details={[
            'Cards for the work queued, in flight, and done',
            'Starting a card starts its Review',
            'A published Review closes its card',
          ]}
        />
      </DaemonGate>
      <ScreenHeader title="Board" />
      <ObserveInteractiveMarker />
    </>
  )
}

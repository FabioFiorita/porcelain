import { ObserveInteractiveMarker } from 'expo-observe'

import { DaemonGate } from '@/components/daemon-gate'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function TerminalScreen(): React.JSX.Element {
  return (
    <>
      <DaemonGate requires="environment">
        <PlaceholderScreen
          description="Daemon-side terminals — the sessions keep running when the phone sleeps."
          details={[
            'PTYs owned by the daemon, attached from the device',
            'Saved Actions for the commands you rerun',
            'Output that survives reconnects',
          ]}
        />
      </DaemonGate>
      <ScreenHeader title="Terminal" />
      <ObserveInteractiveMarker />
    </>
  )
}

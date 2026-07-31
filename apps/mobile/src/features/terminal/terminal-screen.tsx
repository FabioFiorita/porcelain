import { ObserveInteractiveMarker } from 'expo-observe'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { SettingsToolbar } from '@/components/settings-toolbar'

export function TerminalScreen() {
  return (
    <>
      <PlaceholderScreen
        title="Terminal"
        description="Daemon-side terminals — the sessions keep running when the phone sleeps."
        details={[
          'PTYs owned by the daemon, attached from the device',
          'Saved Actions for the commands you rerun',
          'Output that survives reconnects',
        ]}
      />
      <SettingsToolbar />
      <ObserveInteractiveMarker />
    </>
  )
}

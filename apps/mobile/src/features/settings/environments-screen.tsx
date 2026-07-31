import { PlaceholderScreen } from '@/components/placeholder-screen'

export function EnvironmentsScreen() {
  return (
    <PlaceholderScreen
      title="Environments"
      description="Porcelain daemons this device is paired with. Each environment is one daemon plus the repos it exposes."
      details={[
        'Pair over the LAN when the daemon is on the same network',
        'Pair over Tailscale when it is not',
        'Pairing is per device — revoking here does not touch other devices',
        'Development daemons stay separate from production ones',
      ]}
    />
  )
}

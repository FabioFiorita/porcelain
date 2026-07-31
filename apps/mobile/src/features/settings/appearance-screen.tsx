import { PlaceholderScreen } from '@/components/placeholder-screen'

export function AppearanceScreen(): React.JSX.Element {
  return (
    <PlaceholderScreen
      title="Appearance"
      description="How the client renders — it follows the system theme until you say otherwise."
      details={['Light, dark, or system', 'Diff density', 'Monospace type size']}
    />
  )
}

import { PlaceholderScreen } from '@/components/placeholder-screen'

export function HistoryScreen(): React.JSX.Element {
  return (
    <PlaceholderScreen
      description="Commit history, pushed from Changes instead of owning a tab of its own."
      details={[
        'Commits for the current branch, newest first',
        'A commit opens its diff in the Changes stack',
        'Desktop keeps History as its own tab; mobile merges it here',
      ]}
    />
  )
}

import { PlaceholderScreen } from '@/components/placeholder-screen'

export function BoardScreen(): React.JSX.Element {
  return (
    <PlaceholderScreen
      description="The plan behind the reviews — pushed from Review because the two are coupled."
      details={[
        'Cards for the work queued, in flight, and done',
        'Starting a card starts its Review',
        'A published Review closes its card',
      ]}
    />
  )
}

import { ObserveInteractiveMarker } from 'expo-observe'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function BoardScreen(): React.JSX.Element {
  return (
    <>
      <PlaceholderScreen
        description="The plan the reviews are working through."
        details={[
          'Cards for the work queued, in flight, and done',
          'Starting a card starts its Review',
          'A published Review closes its card',
        ]}
      />
      <ScreenHeader title="Board" />
      <ObserveInteractiveMarker />
    </>
  )
}

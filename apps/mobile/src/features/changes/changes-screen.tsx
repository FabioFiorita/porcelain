import { ObserveInteractiveMarker } from 'expo-observe'

import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ScreenHeader } from '@/components/screen-header'

export function ChangesScreen(): React.JSX.Element {
  return (
    <>
      <PlaceholderScreen
        description="The working tree: what the agent touched, staged or not."
        details={[
          'Diffs per file with review-friendly grouping',
          'Staging and unstaging without leaving the diff',
          'Commit composer — the only commit UX in the app',
          'Commit history is pushed from this header',
        ]}
      />
      <ScreenHeader
        action={{ href: '/history', icon: 'history', label: 'History' }}
        title="Changes"
      />
      <ObserveInteractiveMarker />
    </>
  )
}

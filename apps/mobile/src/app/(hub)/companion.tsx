import { useLocalSearchParams } from 'expo-router'

import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { CompanionSheet } from '@/features/shell/companion-sheet'
import type { SurfaceId } from '@/features/shell/surfaces'

/**
 * The active surface's companion, as a presented sheet.
 *
 * The surface is a URL parameter: the bolt that opens this knows which surface it sits on, and
 * a route that says so in its address does not depend on a store write landing first. The
 * store's `activeSurface` is still the fallback for a deep link that names nothing.
 */
export default function CompanionRoute(): React.JSX.Element {
  const { surface } = useLocalSearchParams<{ surface?: SurfaceId }>()
  return (
    <ClearBottomChrome>
      <CompanionSheet surface={surface} />
    </ClearBottomChrome>
  )
}

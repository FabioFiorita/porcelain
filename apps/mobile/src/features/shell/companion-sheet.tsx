import { View } from 'react-native'

import { useShellStore } from './shell-store'
import { surfaceSlots } from './surface-slots'
import type { SurfaceId } from './surfaces'

/**
 * The surface companion's body, filling whatever detent the sheet is resting at.
 *
 * The version this replaces measured the window, computed a panel height, and then subtracted
 * a hand-tuned 170 from it to leave room for a title row and a Done button it also drew itself.
 * A `formSheet` gives the panel its height and its own bar gives it the dismiss control, so the
 * companion just fills the space.
 */
export function CompanionSheet({ surface }: { surface?: SurfaceId }): React.JSX.Element {
  const activeSurface = useShellStore((state) => state.activeSurface)
  const slots = surfaceSlots(surface ?? activeSurface)

  return (
    <View className="flex-1" testID="porcelain-companion-sheet">
      {slots.companion === undefined ? null : <slots.companion active />}
    </View>
  )
}

import { View } from 'react-native'

import { EmptyNote } from '@/components/panel-chrome'

import { SheetHost } from './shell-sheets'
import { surfaceSlots } from './surface-slots'
import type { SurfaceId } from './surfaces'

/**
 * A surface companion's body, filling whatever detent the sheet is resting at.
 *
 * `SheetHost` is what tells the cards inside that they are covering something: acting on one —
 * opening a pin, re-running a search, jumping to a commit — dismisses this sheet first, and the
 * same card mounted in the tablet's Surfaces panel must not dismiss anything. The cards call
 * `useDismissSheet()` either way and it is inert outside a host.
 *
 * The surface comes from the URL: the bolt that opens this knows which surface it sits on, and a
 * route that says so in its address does not depend on a store write landing first.
 */
export function CompanionSheet({ surface }: { surface?: SurfaceId }): React.JSX.Element {
  const slots = surface === undefined ? undefined : surfaceSlots(surface)
  const Companion = slots?.companion

  return (
    <SheetHost>
      <View className="flex-1" testID="porcelain-companion-sheet">
        {Companion === undefined ? (
          <EmptyNote
            body="The bolt only appears on a surface that has one — open Files, History or Search."
            testID="porcelain-companion-empty"
            title="No companion here"
          />
        ) : (
          <Companion active />
        )}
      </View>
    </SheetHost>
  )
}

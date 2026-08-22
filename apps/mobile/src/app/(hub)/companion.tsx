import { useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { PresentedChrome } from '@/features/shell/window-chrome'
import { CompanionSheet } from '@/features/shell/companion-sheet'
import { HeaderDoneButton } from '@/features/shell/header-actions'
import { SheetBar } from '@/features/shell/sheet-bar'
import type { SurfaceId } from '@/features/shell/surfaces'

const TITLE = 'Companion'

/**
 * The active surface's companion, as a presented sheet.
 *
 * The surface is a URL parameter: the bolt that opens this knows which surface it sits on, and
 * a route that says so in its address does not depend on a store write landing first. A deep
 * link that names nothing gets the "no companion here" note rather than whichever surface the
 * shell store happened to hold — the store's `activeSurface` is the tablet panel's tab now, and
 * a sheet opened from a phone has no business reading it.
 *
 * The Done item is declared HERE rather than in the stack layout because it is the sheet's own
 * bar that renders it, and the sheet is what knows it can be dismissed.
 */
export default function CompanionRoute(): React.JSX.Element {
  const { surface } = useLocalSearchParams<{ surface?: SurfaceId }>()
  const done = <HeaderDoneButton testID="companion-done" />

  return (
    <PresentedChrome>
      <View className="flex-1 bg-background">
        <SheetBar action={done} title={TITLE} />
        <CompanionSheet surface={surface} />
      </View>
    </PresentedChrome>
  )
}

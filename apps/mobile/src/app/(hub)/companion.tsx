import { Stack, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { CompanionSheet } from '@/features/shell/companion-sheet'
import { HeaderDoneButton } from '@/features/shell/header-actions'
import { SheetBar } from '@/features/shell/sheet-bar'
import type { SurfaceId } from '@/features/shell/surfaces'

const TITLE = 'Companion'

/**
 * The active surface's companion, as a presented sheet.
 *
 * The surface is a URL parameter: the bolt that opens this knows which surface it sits on, and
 * a route that says so in its address does not depend on a store write landing first. The
 * store's `activeSurface` is still the fallback for a deep link that names nothing.
 *
 * The Done item is declared HERE rather than in the stack layout because two things render it:
 * the native bar on iOS, and `SheetBar` on Android, where the sheet has no native bar at all.
 * One element, handed to both.
 */
export default function CompanionRoute(): React.JSX.Element {
  const { surface } = useLocalSearchParams<{ surface?: SurfaceId }>()
  const done = <HeaderDoneButton testID="porcelain-companion-done" />

  return (
    <ClearBottomChrome>
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerRight: () => done, title: TITLE }} />
        {/* Android's sheet has no bar of its own to hang `headerRight` on; iOS's does. */}
        <SheetBar action={done} title={TITLE} />
        <CompanionSheet surface={surface} />
      </View>
    </ClearBottomChrome>
  )
}

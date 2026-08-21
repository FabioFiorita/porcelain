import { Stack } from 'expo-router'
import { View } from 'react-native'

import { QuickOpenSheet } from '@/features/quick-open/quick-open-sheet'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { HeaderDoneButton } from '@/features/shell/header-actions'
import { SheetBar } from '@/features/shell/sheet-bar'

const TITLE = 'Quick open'

/**
 * Quick open, as a presented sheet rather than a flag on the shell store.
 *
 * `ClearBottomChrome` because a sheet is presented OVER the tab bar, not under it — the
 * clearance every scrolling surface reserves for the bar would be dead space in here.
 *
 * The Done item is declared HERE rather than in the stack layout because two things render it:
 * the native bar on iOS, and `SheetBar` on Android, where the sheet has no native bar at all.
 * One element, handed to both.
 */
export default function QuickOpenRoute(): React.JSX.Element {
  const done = <HeaderDoneButton testID="porcelain-quick-open-done" />

  return (
    <ClearBottomChrome>
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerRight: () => done, title: TITLE }} />
        {/* Android's sheet has no bar of its own to hang `headerRight` on; iOS's does. */}
        <SheetBar action={done} title={TITLE} />
        <QuickOpenSheet />
      </View>
    </ClearBottomChrome>
  )
}

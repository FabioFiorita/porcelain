import { View } from 'react-native'

import { QuickOpenSheet } from '@/features/quick-open/quick-open-sheet'
import { PresentedChrome } from '@/features/shell/window-chrome'
import { HeaderDoneButton } from '@/features/shell/header-actions'
import { SheetBar } from '@/features/shell/sheet-bar'

const TITLE = 'Quick open'

/**
 * Quick open, as a presented sheet rather than a flag on the shell store.
 *
 * `PresentedChrome` because a sheet is presented OVER the tab bar, not under it — the
 * clearance every scrolling surface reserves for the bar would be dead space in here.
 *
 * The Done item is declared HERE rather than in the stack layout because it is the sheet's own
 * bar that renders it, and the sheet is what knows it can be dismissed.
 */
export default function QuickOpenRoute(): React.JSX.Element {
  const done = <HeaderDoneButton testID="porcelain-quick-open-done" />

  return (
    <PresentedChrome>
      <View className="flex-1 bg-background">
        <SheetBar action={done} title={TITLE} />
        <QuickOpenSheet />
      </View>
    </PresentedChrome>
  )
}

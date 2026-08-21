import { View } from 'react-native'

import { ActionsCompanion } from '@/features/actions'
import { PresentedChrome } from '@/features/shell/window-chrome'
import { HeaderDoneButton } from '@/features/shell/header-actions'
import { SheetBar } from '@/features/shell/sheet-bar'

const TITLE = 'Actions'

/**
 * Saved Actions, presented off the Terminals list.
 *
 * An Action has always needed a Worktree to run in, and it runs in the selected one — the same
 * target every other daemon call on this device uses. Reaching it from Terminals is the point:
 * running one IS starting a shell, and this is now the only place shells live.
 *
 * The Done item is declared HERE rather than in the stack layout because it is the sheet's own
 * bar that renders it, and the sheet is what knows it can be dismissed.
 */
export default function TerminalsActionsRoute(): React.JSX.Element {
  const done = <HeaderDoneButton testID="porcelain-terminals-actions-done" />

  return (
    <PresentedChrome>
      <View className="flex-1 bg-background">
        <SheetBar action={done} title={TITLE} />
        <ActionsCompanion active />
      </View>
    </PresentedChrome>
  )
}

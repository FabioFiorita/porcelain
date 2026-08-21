import { Stack } from 'expo-router'
import { View } from 'react-native'

import { ActionsCompanion } from '@/features/actions'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
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
 * The Done item is declared HERE rather than in the stack layout because two things render it:
 * the native bar on iOS, and `SheetBar` on Android, where the sheet has no native bar at all.
 * One element, handed to both.
 */
export default function TerminalsActionsRoute(): React.JSX.Element {
  const done = <HeaderDoneButton testID="porcelain-terminals-actions-done" />

  return (
    <ClearBottomChrome>
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ headerRight: () => done, title: TITLE }} />
        {/* Android's sheet has no bar of its own to hang `headerRight` on; iOS's does. */}
        <SheetBar action={done} title={TITLE} />
        <ActionsCompanion active />
      </View>
    </ClearBottomChrome>
  )
}

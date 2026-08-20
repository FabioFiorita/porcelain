import { ActionsCompanion } from '@/features/actions'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'

/**
 * Saved Actions, presented off the Terminals list.
 *
 * An Action has always needed a Worktree to run in, and it runs in the selected one — the same
 * target every other daemon call on this device uses. Reaching it from Terminals is the point:
 * running one IS starting a shell, and this is now the only place shells live.
 */
export default function TerminalsActionsRoute(): React.JSX.Element {
  return (
    <ClearBottomChrome>
      <ActionsCompanion active />
    </ClearBottomChrome>
  )
}

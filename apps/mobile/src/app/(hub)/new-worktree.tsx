import { NewWorktreeSheet } from '@/features/hub/new-worktree-sheet'
import { PresentedChrome } from '@/features/shell/window-chrome'

/**
 * Adding a Worktree, as a presented sheet. `PresentedChrome` because a sheet is presented
 * OVER the tab bar — the clearance every scrolling surface reserves for it is dead space here.
 */
export default function NewWorktreeRoute(): React.JSX.Element {
  return (
    <PresentedChrome>
      <NewWorktreeSheet />
    </PresentedChrome>
  )
}

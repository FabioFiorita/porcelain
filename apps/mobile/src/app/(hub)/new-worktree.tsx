import { NewWorktreeSheet } from '@/features/hub/new-worktree-sheet'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'

/**
 * Adding a Worktree, as a presented sheet. `ClearBottomChrome` because a sheet is presented
 * OVER the tab bar — the clearance every scrolling surface reserves for it is dead space here.
 */
export default function NewWorktreeRoute(): React.JSX.Element {
  return (
    <ClearBottomChrome>
      <NewWorktreeSheet />
    </ClearBottomChrome>
  )
}

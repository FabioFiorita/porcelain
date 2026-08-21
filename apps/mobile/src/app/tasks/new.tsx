import { ClearBottomChrome } from '@/features/shell/bottom-chrome'
import { NewTaskSheet } from '@/features/tasks'

/**
 * Composing a Task, as a presented sheet. `ClearBottomChrome` because a sheet is presented
 * OVER the tab bar — the clearance every scrolling surface reserves for it is dead space here.
 */
export default function NewTaskRoute(): React.JSX.Element {
  return (
    <ClearBottomChrome>
      <NewTaskSheet />
    </ClearBottomChrome>
  )
}

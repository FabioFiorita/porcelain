import { PresentedChrome } from '@/features/shell/window-chrome'
import { NewTaskSheet } from '@/features/tasks'

/**
 * Composing a Task, as a presented sheet. `PresentedChrome` because a sheet is presented
 * OVER the tab bar — the clearance every scrolling surface reserves for it is dead space here.
 */
export default function NewTaskRoute(): React.JSX.Element {
  return (
    <PresentedChrome>
      <NewTaskSheet />
    </PresentedChrome>
  )
}

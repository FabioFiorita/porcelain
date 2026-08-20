import { QuickOpenSheet } from '@/features/quick-open/quick-open-sheet'
import { ClearBottomChrome } from '@/features/shell/bottom-chrome'

/**
 * Quick open, as a presented sheet rather than a flag on the shell store.
 *
 * `ClearBottomChrome` because a sheet is presented OVER the tab bar, not under it — the
 * clearance every scrolling surface reserves for the bar would be dead space in here.
 */
export default function QuickOpenRoute(): React.JSX.Element {
  return (
    <ClearBottomChrome>
      <QuickOpenSheet />
    </ClearBottomChrome>
  )
}

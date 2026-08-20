import { PhoneBottomChrome } from './bottom-chrome'
import { PhoneShell } from './phone-shell'

/**
 * PARKED. The tablet had its own shell — a three-column `SplitView` with a rail, a
 * supplementary list, and an inspector — built on the surfaces-as-destinations model this
 * change replaces. Tablet design waits until web and the Mac app settle, so rather than port a
 * layout that is about to be redesigned, the iPad runs the phone shell.
 *
 * Deliberately a one-line body, not a deleted file: the split-view layout is a decision that is
 * coming back, and this is where it goes when it does.
 */
export function TabletShell(): React.JSX.Element {
  return (
    <PhoneBottomChrome>
      <PhoneShell />
    </PhoneBottomChrome>
  )
}

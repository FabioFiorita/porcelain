import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** Height of the floating native tab bar the scrolling surfaces pass beneath. */
const TAB_BAR_HEIGHT = 52

/**
 * Bottom padding a scrolling phone surface needs to clear the tab bar.
 *
 * The iOS 26 tab bar floats over the content instead of reserving space below it, so a list
 * that stops at the safe-area inset leaves its last rows stranded underneath with no way to
 * scroll them clear. Pushed detail screens keep the tab bar on screen, so they need this too.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets()
  return insets.bottom + TAB_BAR_HEIGHT
}

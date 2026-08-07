import { createContext, useContext } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * How much chrome floats over the bottom of whatever is mounted inside — in points.
 *
 * This is a property of the SHELL, not of the surface. The phone mounts its screens under a
 * floating iOS tab bar that overlays content instead of reserving space below it; the iPad
 * mounts the same screens inside SplitView columns that already end above their own chrome.
 * The identical component is correct in both places only if it can ask where it is.
 *
 * Before this, every surface answered that question for itself by calling a `useTabBarInset()`
 * hook that always returned the phone's answer, and then threading the number down through as
 * many as five layers of props. Two failure modes fell out of it, and both shipped:
 *
 *   - The hook lied off-phone. `ReviewCanvas` is shared by the phone tab and the iPad viewer
 *     column, so every body that called the hook directly reserved ~86pt for a tab bar the
 *     iPad does not have.
 *   - A prop and the hook could disagree on the same screen. `ReviewCanvas` took a
 *     `bottomInset` prop but forwarded it to only one of its three bodies; the other two
 *     called the hook. Nothing made them agree, and nothing noticed when they didn't.
 *
 * A shell-provided value cannot lie: it is zero unless a provider says otherwise, and the only
 * thing allowed to say otherwise is the shell that owns the chrome. This is the same shape as
 * `ColumnOverflowContext` in `shell-chrome`, which the tablet has used for its own bottom-edge
 * problem all along — the phone simply never joined it.
 *
 * Read it through `SurfaceScroll` / `SurfaceList` rather than directly. A component that needs
 * the raw number is anchoring something to the bottom edge by hand (the comment selection bar),
 * which is the only remaining reason to call `useBottomChrome`.
 */
const BottomChromeContext = createContext(0)

/**
 * The phone shell's bottom chrome: the floating tab bar plus the home indicator under it.
 *
 * `insets.bottom` is the WHOLE answer, and the measurement that proves it is worth keeping.
 * Inside a `UITabBarController` child — which is what `NativeTabs` renders — UIKit already
 * folds the tab bar into the view controller's safe area, so on an iPhone 17 Pro this reads
 * **81pt**: 34 of home indicator plus 47 of tab bar. Nothing has to be added to it.
 *
 * The code this replaces added a hardcoded `TAB_BAR_HEIGHT = 52` on top and reserved 133pt for
 * 81pt of chrome. Every scrolling surface in the app carried ~52pt of padding under its last
 * row, which is the "strange gap at the bottom" that no amount of per-screen tuning fixed —
 * each fix moved the number without ever asking what `insets.bottom` already contained.
 *
 * That is also why the constant had to go rather than move somewhere tidier: a bar whose height
 * UIKit already reports needs no constant, and `minimizeBehavior="onScrollDown"` shrinking the
 * bar mid-scroll is tracked for free by the same measurement.
 *
 * Wraps the tab navigator, so every tab root AND every route pushed inside a tab inherits it —
 * a pushed detail screen keeps the tab bar on screen and needs exactly the same clearance.
 */
export function PhoneBottomChrome({ children }: { children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets()
  return (
    <BottomChromeContext.Provider value={insets.bottom}>{children}</BottomChromeContext.Provider>
  )
}

/**
 * For a screen presented OVER the shell's chrome — a `fullScreenModal`, a `Modal`.
 *
 * The bar is not on screen, so nothing should be reserved for it. Without this the terminal
 * session screen lost ~81pt of grid to a tab bar its own layout comment explains it is
 * presented above precisely to escape.
 *
 * A `Modal` needs more than this, because `useSafeAreaInsets` is also inherited from the
 * covered screen and reports the bar in `insets.bottom` — see `EvidenceGallery`, which nests
 * its own `SafeAreaProvider`.
 */
export function ClearBottomChrome({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <BottomChromeContext.Provider value={0}>{children}</BottomChromeContext.Provider>
}

/**
 * Points of floating chrome over this surface's bottom edge.
 *
 * Zero outside a shell that declares any — which is the correct answer for every tablet column,
 * and for a component rendered in a test.
 */
export function useBottomChrome(): number {
  return useContext(BottomChromeContext)
}

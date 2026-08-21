import { createContext, useContext } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * What the shell puts at the top and bottom edges of whatever is mounted inside it — in points.
 *
 * These are properties of the SHELL, not of the surface. The identical viewer body is mounted by
 * a phone tab, by an iPad column, and by a full-screen modal presented over both, and it is
 * correct in all three only if it can ask where it is. Before this each edge was answered by a
 * hook that always gave the phone's answer, or by a number threaded down through as many as five
 * layers of props — so a shared body reserved a phone's tab bar inside an iPad column, and a
 * viewer that forwarded the prop to one of its three bodies left the other two disagreeing with
 * it. A shell-provided value cannot lie.
 *
 * Both edges default to the plain phone answer and are overridden by whoever knows better: a
 * presented screen at the bottom, a column at the top.
 */

const BottomChromeContext = createContext(0)

/**
 * The status-bar inset a screen has to clear with its own header, or `null` for "ask the window".
 *
 * Null rather than a number so the common case stays live: `useSafeAreaInsets` changes on
 * rotation and on an iPad window resize, and a provider that captured it once would freeze it.
 */
const TopChromeContext = createContext<number | null>(null)

/**
 * For a screen presented OVER the shell — a `fullScreenModal`, a `formSheet`, a `Modal`.
 *
 * **Bottom:** the tab bar is not under it, so the home indicator is the surface's own problem.
 * **Top:** a sheet is inset from the top of the window and never reaches the status bar, so its
 * header adds nothing; a full-screen modal does, and passes `coversStatusBar`.
 */
export function PresentedChrome({
  children,
  coversStatusBar = false,
}: {
  children: React.ReactNode
  /** True for a `fullScreenModal`, which owns the status bar like any other full screen. */
  coversStatusBar?: boolean
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  return (
    <BottomChromeContext.Provider value={insets.bottom}>
      <TopChromeContext.Provider value={coversStatusBar ? insets.top : 0}>
        {children}
      </TopChromeContext.Provider>
    </BottomChromeContext.Provider>
  )
}

/**
 * For a tablet column that is not the one touching the top of the window, or any body mounted
 * below chrome the shell has already drawn.
 */
export function ColumnChrome({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <TopChromeContext.Provider value={0}>{children}</TopChromeContext.Provider>
}

/**
 * Points of chrome this surface has to clear at its bottom edge.
 *
 * Zero unless a shell says otherwise — which is the correct answer inside the tab shell, inside
 * every tablet column, and in a test. It used to be the tab bar's height, because a `UITabBar`
 * floats over its content and UIKit folds it into the safe area; `PorcelainTabBar` is an
 * ordinary row in a column, so content simply ends above it.
 */
export function useBottomChrome(): number {
  return useContext(BottomChromeContext)
}

/**
 * Points of status bar this screen's own header has to clear.
 *
 * Every screen owns this now: there is no `UINavigationBar` above it to have cleared it first.
 * `ScreenHeader` reads it so a screen does not pass it, and a screen that is not at the top of
 * the window reads zero without knowing that it is not.
 */
export function useTopChrome(): number {
  const declared = useContext(TopChromeContext)
  const insets = useSafeAreaInsets()
  return declared ?? insets.top
}

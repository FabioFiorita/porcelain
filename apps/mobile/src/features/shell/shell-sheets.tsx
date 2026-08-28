import { type Href, useRouter } from 'expo-router'
import { createContext, useCallback, useContext } from 'react'

/**
 * The three sheets the shell owns, and the route each one is.
 *
 * These used to be a `sheet: 'search' | 'settings' | 'companion' | null` field on the shell
 * store, with a `<ShellSheets />` component mounted for the whole app life, watching it, and
 * rendering a transparent `Modal` when it changed. Presentation was app state, so every
 * question the navigator already answers — is it open, what is behind it, what does back do,
 * can two be open at once — had to be answered again by hand, and the last one was answered
 * with a module-level counter and a `console.warn`.
 *
 * A sheet is a screen now. The kinds survive because they are the shell's vocabulary; what
 * they map to is an address rather than a flag.
 */
export type ShellSheet = 'search' | 'settings'

const SHELL_SHEET_HREF: Record<ShellSheet, Href> = {
  search: '/quick-open',
  // Settings is a tab, not an overlay. Naming it here keeps "go to Settings" one lookup rather
  // than a route literal repeated wherever a destination list mentions it.
  settings: '/settings',
}

export function shellSheetHref(sheet: ShellSheet): Href {
  return SHELL_SHEET_HREF[sheet]
}

/**
 * Whether the subtree is inside a presented sheet.
 *
 * The companion cards are hosted two ways — the phone's bolt sheet, and (as sections of a
 * surface) the tablet's trailing panel — and a card that acts has to get out of the way in the
 * first and stay put in the second. Every one of them answered that with `useIsTablet()`, which
 * is a guess about the host dressed up as a fact about the device: the same card on a tablet
 * IS in a sheet when the window is too narrow for panels, and the guess was wrong there in the
 * one direction that costs a navigation.
 *
 * The host declares itself instead.
 */
const SheetHostContext = createContext(false)

/** Wraps a sheet's body so the cards inside it know they are covering something. */
export function SheetHost({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <SheetHostContext.Provider value={true}>{children}</SheetHostContext.Provider>
}

export function useInSheet(): boolean {
  return useContext(SheetHostContext)
}

/**
 * Dismiss the sheet this component is inside — **and nothing at all when it is not inside one**.
 *
 * The companion's cards act and then get out of the way: open the pinned file, re-run the recent
 * search, jump to the commit. Callers dismiss BEFORE they navigate, so the push lands on the
 * screen the sheet was covering rather than on the sheet. Hosted in a panel there is no sheet to
 * pop, and popping anyway would take the viewer's stack down a screen for no reason — so this
 * is a no-op there, and the call site keeps one code path.
 */
export function useDismissSheet(): () => void {
  const router = useRouter()
  const inSheet = useInSheet()
  return useCallback((): void => {
    if (!inSheet) return
    router.back()
  }, [inSheet, router])
}

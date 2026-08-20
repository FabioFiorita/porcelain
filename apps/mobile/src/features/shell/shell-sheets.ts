import { type Href, useRouter } from 'expo-router'
import { useCallback } from 'react'

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
export type ShellSheet = 'search' | 'settings' | 'companion'

const SHELL_SHEET_HREF: Record<ShellSheet, Href> = {
  // The surface companion takes `?surface=` — see `header-actions.tsx`; this is its bare form.
  companion: '/companion',
  search: '/quick-open',
  // Settings is a tab, not an overlay. Naming it here keeps "go to Settings" one lookup rather
  // than a route literal repeated wherever a destination list mentions it.
  settings: '/settings',
}

export function shellSheetHref(sheet: ShellSheet): Href {
  return SHELL_SHEET_HREF[sheet]
}

/**
 * Dismiss the sheet this component is inside.
 *
 * The companion's cards act and then get out of the way — open the pinned file, re-run the
 * recent search, jump to the commit. That used to be `closeSheet()` clearing a store field;
 * a presented route pops instead. Callers still dismiss BEFORE they navigate, so the push
 * lands on the screen the sheet was covering rather than on the sheet.
 */
export function useDismissSheet(): () => void {
  const router = useRouter()
  return useCallback((): void => {
    router.back()
  }, [router])
}

import { type ThemeMode, usePreferencesStore } from '@renderer/stores/preferences'

// Framework-free theme resolution + DOM application. The React surface (a hook +
// the shell-sync effect) lives in hooks/use-theme.ts; this module is the pure
// logic so it can run pre-paint in main.tsx and be driven from the (non-React)
// terminal registry without importing React.

const DARK_QUERY = '(prefers-color-scheme: dark)'

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

/** Resolve a preference to a concrete appearance, reading the OS for `system`. */
export function resolveTheme(pref: ThemeMode): 'light' | 'dark' {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light'
  return pref
}

/**
 * Apply a resolved appearance to the document: toggle the `dark` class the
 * `@custom-variant dark` + `.dark` token block key off, and set `color-scheme`
 * so native form controls / scrollbars follow.
 */
export function applyResolvedTheme(mode: 'light' | 'dark'): void {
  const root = document.documentElement
  root.classList.toggle('dark', mode === 'dark')
  root.style.colorScheme = mode
}

/**
 * Subscribe to both inputs that determine the resolved appearance — the
 * `theme` preference and the OS `prefers-color-scheme` media query — invoking
 * `callback` with the newly resolved mode whenever it actually changes.
 * Deduped: a preference edit or media flip that leaves the resolved mode
 * unchanged (e.g. `system`→`light` while the OS is already light) does not fire.
 * Returns an unsubscribe.
 */
export function subscribeResolvedTheme(callback: (mode: 'light' | 'dark') => void): () => void {
  let current = resolveTheme(usePreferencesStore.getState().theme)
  const notify = (): void => {
    const next = resolveTheme(usePreferencesStore.getState().theme)
    if (next === current) return
    current = next
    callback(next)
  }
  const unsubscribeStore = usePreferencesStore.subscribe(notify)
  const media =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DARK_QUERY)
      : null
  media?.addEventListener('change', notify)
  return () => {
    unsubscribeStore()
    media?.removeEventListener('change', notify)
  }
}

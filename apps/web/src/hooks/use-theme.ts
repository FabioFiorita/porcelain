import { isBrowser } from '@renderer/lib/platform'
import { applyResolvedTheme, resolveTheme, subscribeResolvedTheme } from '@renderer/lib/theme'
import { shellTrpcClient } from '@renderer/lib/trpc'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useEffect, useSyncExternalStore } from 'react'

function resolvedSnapshot(): 'light' | 'dark' {
  return resolveTheme(usePreferencesStore.getState().theme)
}

/**
 * The current resolved appearance ('light' | 'dark'), tracking both the `theme`
 * preference and the OS `prefers-color-scheme`. Re-renders the caller only when
 * the resolved mode actually flips (useSyncExternalStore dedupes on the snapshot,
 * and subscribeResolvedTheme is deduped too). Read it wherever a value — not a
 * CSS class — must follow the theme (Shiki, xterm, the toaster).
 */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeResolvedTheme, resolvedSnapshot, resolvedSnapshot)
}

/**
 * Mount ONCE (in AppShell, beside the other one-shot hooks): keep the document
 * and the Electron shell in step with the appearance preference.
 *
 * The shell gets the raw preference (`system` | `light` | `dark`), not the resolved
 * mode — sending only light/dark pinned Electron's `nativeTheme`, making Settings →
 * System a no-op for window chrome. The document still applies the resolved class.
 */
export function useThemeSync(): void {
  useEffect(() => {
    const push = (): void => {
      const pref = usePreferencesStore.getState().theme
      applyResolvedTheme(resolveTheme(pref))
      if (!isBrowser) shellTrpcClient.setThemeSource.mutate(pref)
    }
    push()
    // Preference edits must always push (even system→dark when OS is already dark)
    // so the shell re-enters themeSource: 'system'.
    const unsubStore = usePreferencesStore.subscribe(push)
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null
    media?.addEventListener('change', push)
    return () => {
      unsubStore()
      media?.removeEventListener('change', push)
    }
  }, [])
}

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
 * and the Electron shell in step with the resolved appearance. main.tsx already
 * applied it pre-paint; this re-applies on every later change (preference edit or
 * OS flip) and, on every resolved-mode change including the initial mount, tells
 * the shell so it can retint the native chrome + window background. Guarded with
 * `isBrowser` — the browser client has no shell bridge, so nothing may throw.
 */
export function useThemeSync(): void {
  useEffect(() => {
    const push = (mode: 'light' | 'dark'): void => {
      applyResolvedTheme(mode)
      // Bare fire-and-forget mutate (like stores/terminals.ts) — nothing awaits
      // the OS chrome update.
      if (!isBrowser) shellTrpcClient.setThemeSource.mutate(mode)
    }
    // Initial mount: notify for the current resolved mode (main.tsx already
    // applied the class, but the shell hasn't been told yet).
    push(resolvedSnapshot())
    return subscribeResolvedTheme(push)
  }, [])
}

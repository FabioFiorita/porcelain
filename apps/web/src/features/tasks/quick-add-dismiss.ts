import { isBrowser } from '@renderer/lib/platform'
import { settleBackground } from '@shared/background'
import { shellTrpc } from '@renderer/lib/trpc'
import { useCallback } from 'react'

/**
 * Close the menu-bar popover this surface is rendered in.
 *
 * The window belongs to the Electron main process, so dismissal is a SHELL procedure
 * (`closeQuickAdd`), scoped to the calling window. In the browser client there is no such
 * window — `#/quick-add` is a shell-only surface — so this is a no-op there rather than a
 * failed shell call.
 */
export function useQuickAddDismiss(): () => void {
  const shellClient = shellTrpc.useUtils().client
  return useCallback(() => {
    if (isBrowser) return
    // Dismissal is lifecycle, not a user-visible result: the window is going away, so
    // there is nowhere left to render a failure.
    settleBackground(shellClient.closeQuickAdd.mutate(), 'lifecycle')
  }, [shellClient])
}

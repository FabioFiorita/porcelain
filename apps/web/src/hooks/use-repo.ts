import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Opens another window — `openWindow()` raises a welcome window, `openWindow(repoPath)`
 * opens that repo in a fresh window; the current one stays put either way. Wraps the raw
 * mutation in a small domain object, matching the other mutation hooks (e.g. useInstallUpdate)
 * so callers — and their tests — never handle the TanStack result directly.
 */
export function useNewWindow(): { openWindow: (repoPath?: string) => void } {
  const mutation = shellTrpc.newWindow.useMutation()
  return {
    openWindow: (repoPath?: string): void => mutation.mutate(repoPath ? { repoPath } : undefined),
  }
}

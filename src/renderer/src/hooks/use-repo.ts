import type { RepoInfo } from '@main/api'
import { trpc } from '@renderer/lib/trpc'

/** Recent repos for the welcome screen + project switcher; pass `enabled` to gate. */
export function useRecentRepos(enabled = true): RepoInfo[] {
  const { data = [] } = trpc.recentRepos.useQuery(undefined, { enabled })
  return data
}

/**
 * Opens another window — `openWindow()` raises a welcome window, `openWindow(repoPath)`
 * opens that repo in a fresh window; the current one stays put either way. Wraps the raw
 * mutation in a small domain object, matching the other mutation hooks (e.g. useInstallUpdate)
 * so callers — and their tests — never handle the TanStack result directly.
 */
export function useNewWindow(): { openWindow: (repoPath?: string) => void } {
  const mutation = trpc.newWindow.useMutation()
  return { openWindow: (repoPath) => mutation.mutate(repoPath ? { repoPath } : undefined) }
}

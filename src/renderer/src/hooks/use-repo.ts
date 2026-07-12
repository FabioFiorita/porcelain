import type { RepoInfo } from '@backend/api'
import { shellTrpc, trpc } from '@renderer/lib/trpc'

/** Recent repos for the welcome screen + project switcher; pass `enabled` to gate. */
export function useRecentRepos(enabled = true): RepoInfo[] {
  const { data = [] } = trpc.recentRepos.useQuery(undefined, { enabled })
  return data
}

/**
 * Removes a repo from the recents list (the project switcher's "Projects"). The list is
 * small and the write instant, so `onSuccess` just invalidates `recentRepos` — no optimistic
 * update. The repo's per-repo config (hidden/pinned paths) survives a later re-open.
 */
export function useRemoveRecentRepo(): { remove: (repoPath: string) => void } {
  const utils = trpc.useUtils()
  const mutation = trpc.removeRecentRepo.useMutation({
    onSuccess: async () => {
      await utils.recentRepos.invalidate()
    },
  })
  return { remove: (repoPath) => mutation.mutate(repoPath) }
}

/**
 * Opens another window — `openWindow()` raises a welcome window, `openWindow(repoPath)`
 * opens that repo in a fresh window; the current one stays put either way. Wraps the raw
 * mutation in a small domain object, matching the other mutation hooks (e.g. useInstallUpdate)
 * so callers — and their tests — never handle the TanStack result directly.
 */
export function useNewWindow(): { openWindow: (repoPath?: string) => void } {
  const mutation = shellTrpc.newWindow.useMutation()
  return { openWindow: (repoPath) => mutation.mutate(repoPath ? { repoPath } : undefined) }
}

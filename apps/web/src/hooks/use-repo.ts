import type { RepoInfo } from '@backend/api'
import { announceSession } from '@renderer/lib/daemon'
import { shellTrpc, trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useEffect } from 'react'

/** Recent repos for the welcome screen + project switcher; pass `enabled` to gate. */
export function useRecentRepos(enabled = true): RepoInfo[] {
  const { data = [] } = trpc.recentRepos.useQuery(undefined, { enabled })
  return data
}

/**
 * Tell the daemon which repo this window is looking at, so the device roster
 * (Settings → Environments) shows what each paired device is DOING. Mounted once in
 * `AppShell` above its welcome-screen early return, the twin of `useWatchOpenFiles`: the
 * announce rides the WS session (per-connection state, so it lives there, not on the
 * router) and re-fires on a repo switch — including back to no repo, which clears the row.
 */
export function useAnnounceSession(): void {
  const repoPath = useRepoStore((s) => s.repo?.path)

  useEffect(() => {
    announceSession(repoPath)
  }, [repoPath])
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
  return { remove: (repoPath: string): void => mutation.mutate(repoPath) }
}

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

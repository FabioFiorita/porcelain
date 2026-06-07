import type { RepoInfo } from '@main/api'
import { trpc } from '@renderer/lib/trpc'

/** Recent repos for the welcome screen + project switcher; pass `enabled` to gate. */
export function useRecentRepos(enabled = true): RepoInfo[] {
  const { data = [] } = trpc.recentRepos.useQuery(undefined, { enabled })
  return data
}

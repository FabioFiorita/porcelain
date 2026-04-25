import { trpcClient } from '@renderer/lib/trpc'
import { create } from 'zustand'
import type { RepoInfo } from '../../../main/api'

interface RepoState {
  repo: RepoInfo | null
  restoring: boolean
  showHidden: boolean
  restoreLastRepo: () => Promise<void>
  openRepo: () => Promise<void>
  openRepoPath: (path: string) => Promise<void>
  toggleShowHidden: () => void
}

export const useRepoStore = create<RepoState>((set) => ({
  repo: null,
  restoring: true,
  showHidden: false,
  restoreLastRepo: async () => {
    try {
      const [last] = await trpcClient.recentRepos.query()
      if (last) set({ repo: await trpcClient.openRepoPath.mutate(last.path) })
    } catch {
      // last repo may no longer exist; fall through to the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  openRepo: async () => {
    const repo = await trpcClient.openRepo.query()
    if (repo) set({ repo })
  },
  openRepoPath: async (path) => {
    set({ repo: await trpcClient.openRepoPath.mutate(path) })
  },
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
}))

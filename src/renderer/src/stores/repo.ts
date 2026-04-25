import { trpc } from '@renderer/lib/trpc'
import { create } from 'zustand'
import type { RepoInfo } from '../../../main/api'

interface RepoState {
  repo: RepoInfo | null
  restoring: boolean
  showHidden: boolean
  treeVersion: number
  restoreLastRepo: () => Promise<void>
  openRepo: () => Promise<void>
  openRepoPath: (path: string) => Promise<void>
  toggleShowHidden: () => void
  refreshTree: () => void
}

export const useRepoStore = create<RepoState>((set) => ({
  repo: null,
  restoring: true,
  showHidden: false,
  treeVersion: 0,
  restoreLastRepo: async () => {
    try {
      const [last] = await trpc.recentRepos.query()
      if (last) set({ repo: await trpc.openRepoPath.mutate(last.path) })
    } catch {
      // last repo may no longer exist; fall through to the welcome screen
    } finally {
      set({ restoring: false })
    }
  },
  openRepo: async () => {
    const repo = await trpc.openRepo.query()
    if (repo) set({ repo })
  },
  openRepoPath: async (path) => {
    set({ repo: await trpc.openRepoPath.mutate(path) })
  },
  toggleShowHidden: () =>
    set((s) => ({ showHidden: !s.showHidden, treeVersion: s.treeVersion + 1 })),
  refreshTree: () => set((s) => ({ treeVersion: s.treeVersion + 1 })),
}))

import { trpc } from '@renderer/lib/trpc'
import { create } from 'zustand'
import type { RepoInfo } from '../../../main/api'

interface RepoState {
  repo: RepoInfo | null
  showHidden: boolean
  treeVersion: number
  openRepo: () => Promise<void>
  openRepoPath: (path: string) => Promise<void>
  toggleShowHidden: () => void
  refreshTree: () => void
}

export const useRepoStore = create<RepoState>((set) => ({
  repo: null,
  showHidden: false,
  treeVersion: 0,
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

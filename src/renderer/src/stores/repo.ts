import { trpc } from '@renderer/lib/trpc'
import { create } from 'zustand'
import type { RepoInfo } from '../../../main/api'

interface RepoState {
  repo: RepoInfo | null
  openRepo: () => Promise<void>
}

export const useRepoStore = create<RepoState>((set) => ({
  repo: null,
  openRepo: async () => {
    const repo = await trpc.openRepo.query()
    if (repo) set({ repo })
  },
}))

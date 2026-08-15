import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WorktreeSetup {
  startScript: string
  disposeScript: string
}

export const EMPTY_WORKTREE_SETUP: WorktreeSetup = {
  startScript: '',
  disposeScript: '',
}

interface WorktreeSetupState {
  setups: Record<string, WorktreeSetup>
  setSetup: (projectId: string, setup: WorktreeSetup) => void
}

export const useWorktreeSetupStore = create<WorktreeSetupState>()(
  persist(
    (set) => ({
      setups: {},
      setSetup: (projectId: string, setup: WorktreeSetup) =>
        set((state) => ({ setups: { ...state.setups, [projectId]: setup } })),
    }),
    { name: 'porcelain-worktree-setups' },
  ),
)

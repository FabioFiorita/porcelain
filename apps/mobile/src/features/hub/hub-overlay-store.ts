import type { HubProject } from '@porcelain/contracts/projects'
import { create } from 'zustand'

import type { Environment } from '@/features/remote'

export type WorktreeSetupTarget = { environment: Environment; project: HubProject }

type HubOverlayState = {
  projectPickerOpen: boolean
  worktreeSetup: WorktreeSetupTarget | null
  openProjectPicker: () => void
  closeProjectPicker: () => void
  openWorktreeSetup: (target: WorktreeSetupTarget) => void
  closeWorktreeSetup: () => void
}

export const useHubOverlayStore = create<HubOverlayState>()((set) => ({
  closeProjectPicker: () => set({ projectPickerOpen: false }),
  closeWorktreeSetup: () => set({ worktreeSetup: null }),
  openProjectPicker: () => set({ projectPickerOpen: true }),
  openWorktreeSetup: (worktreeSetup) => set({ worktreeSetup }),
  projectPickerOpen: false,
  worktreeSetup: null,
}))

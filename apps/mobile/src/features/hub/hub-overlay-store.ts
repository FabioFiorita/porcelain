import type { HubProject } from '@porcelain/contracts/projects'
import { create } from 'zustand'

import type { Environment } from '@/features/remote'

export type WorktreeSetupTarget = { environment: Environment; project: HubProject }
export type WorktreeScriptsTarget = WorktreeSetupTarget

type HubOverlayState = {
  projectPickerOpen: boolean
  worktreeSetup: WorktreeSetupTarget | null
  worktreeScripts: WorktreeScriptsTarget | null
  openProjectPicker: () => void
  closeProjectPicker: () => void
  openWorktreeSetup: (target: WorktreeSetupTarget) => void
  closeWorktreeSetup: () => void
  openWorktreeScripts: (target: WorktreeScriptsTarget) => void
  closeWorktreeScripts: () => void
}

export const useHubOverlayStore = create<HubOverlayState>()((set) => ({
  closeProjectPicker: () => set({ projectPickerOpen: false }),
  closeWorktreeSetup: () => set({ worktreeSetup: null }),
  closeWorktreeScripts: () => set({ worktreeScripts: null }),
  openProjectPicker: () => set({ projectPickerOpen: true }),
  openWorktreeSetup: (worktreeSetup) => set({ worktreeSetup }),
  openWorktreeScripts: (worktreeScripts) => set({ worktreeScripts }),
  projectPickerOpen: false,
  worktreeSetup: null,
  worktreeScripts: null,
}))

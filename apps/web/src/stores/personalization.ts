import { create } from 'zustand'

/**
 * Which Project's profile is on screen.
 *
 * Pins, hides, and layer order belong to a Project, and the place a human thinks about a
 * Project is its row in the sidebar tree — so the gesture is that row's context menu while
 * the dialog mounts beside the tree. Same "one dialog, several openers" shape as
 * Worktree scripts.
 */
export interface PersonalizationTarget {
  projectId: string
  projectName: string
  projectPath: string
  environmentId: string
}

interface PersonalizationState {
  target: PersonalizationTarget | null
  open: (target: PersonalizationTarget) => void
  close: () => void
}

export const usePersonalizationStore = create<PersonalizationState>((set) => ({
  target: null,
  open: (target: PersonalizationTarget) => set({ target }),
  close: () => set({ target: null }),
}))

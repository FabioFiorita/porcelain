import { create } from 'zustand'

/**
 * Which Project's story-order instruction is on screen. The gesture belongs to the Project row's
 * context menu while the dialog mounts beside the tree.
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

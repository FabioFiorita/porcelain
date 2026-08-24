import { create } from 'zustand'

/**
 * Which Project's profile is on screen.
 *
 * Pins, hides, and layer order belong to a Project. The place a human thinks about a Project
 * is its name in the Hub list, so the gesture is a long-press on that name.
 */
export type PersonalizationTarget = {
  projectId: string
  projectName: string
  projectPath: string
  environmentId: string
}

type PersonalizationState = {
  target: PersonalizationTarget | null
  open: (target: PersonalizationTarget) => void
  close: () => void
}

export const usePersonalizationStore = create<PersonalizationState>()((set) => ({
  close: () => {
    set({ target: null })
  },
  open: (target) => {
    set({ target })
  },
  target: null,
}))

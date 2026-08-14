import { create } from 'zustand'

type ActionsSelectionState = {
  selectedActionId: string | null
  clearSelectedAction: () => void
  selectAction: (id: string) => void
}

/** A quick-open handoff: Terminal owns the destination, Actions owns the selected command. */
export const useActionsSelectionStore = create<ActionsSelectionState>()((set) => ({
  clearSelectedAction: () => {
    set({ selectedActionId: null })
  },
  selectAction: (selectedActionId) => {
    set({ selectedActionId })
  },
  selectedActionId: null,
}))

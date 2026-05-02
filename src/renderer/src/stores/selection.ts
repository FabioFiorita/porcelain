import { create } from 'zustand'

interface SelectionState {
  /** Absolute paths of tree entries selected via cmd-click. */
  selected: ReadonlySet<string>
  toggle: (path: string) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: new Set<string>(),
  toggle: (path) =>
    set((s) => {
      const selected = new Set(s.selected)
      if (selected.has(path)) selected.delete(path)
      else selected.add(path)
      return { selected }
    }),
  clear: () => set({ selected: new Set<string>() }),
}))

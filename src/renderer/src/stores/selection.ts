import { create } from 'zustand'

interface SelectionState {
  /** Absolute paths of tree entries selected via cmd-click. */
  selected: ReadonlySet<string>
  /** The last single-clicked row — keyboard file ops target this when nothing is
   *  multi-selected (new file/folder land in/next to it; rename/duplicate act on it). */
  active: { path: string; kind: 'file' | 'dir' } | null
  toggle: (path: string) => void
  setActive: (entry: { path: string; kind: 'file' | 'dir' } | null) => void
  clear: () => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: new Set<string>(),
  active: null,
  toggle: (path) =>
    set((s) => {
      const selected = new Set(s.selected)
      if (selected.has(path)) selected.delete(path)
      else selected.add(path)
      return { selected }
    }),
  setActive: (entry) => set({ active: entry }),
  clear: () => set({ selected: new Set<string>() }),
}))

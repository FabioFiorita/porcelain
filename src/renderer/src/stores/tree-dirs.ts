import { create } from 'zustand'

/**
 * The set of directories currently expanded in the Files tree (each `DirNode`
 * registers its absolute path while open; the tree root registers the repo root).
 * `useWatchTreeDirs` pushes this set to main, which watches those dirs so an
 * external add/remove — the coding agent creating files in the terminal —
 * live-refreshes the tree instead of waiting for the next tab switch. This is the
 * tree twin of the open-files watcher (`useWatchOpenFiles`); like the reveal store
 * it is UI-derived, not persisted.
 */
interface TreeDirsState {
  dirs: Set<string>
  add: (path: string) => void
  remove: (path: string) => void
}

export const useTreeDirsStore = create<TreeDirsState>((set) => ({
  dirs: new Set<string>(),
  // Return the unchanged state on a no-op so subscribers (the pushing hook) don't
  // re-run for a set that didn't actually change.
  add: (path) =>
    set((s) => {
      if (s.dirs.has(path)) return s
      const dirs = new Set(s.dirs)
      dirs.add(path)
      return { dirs }
    }),
  remove: (path) =>
    set((s) => {
      if (!s.dirs.has(path)) return s
      const dirs = new Set(s.dirs)
      dirs.delete(path)
      return { dirs }
    }),
}))

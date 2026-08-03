import { create } from 'zustand'

/**
 * Tree-wide expansion control. Folder expansion is per-`DirNode` local state (the
 * tree reads lazily, so there is no central expansion map to clear), so
 * "collapse all" can't just reset one store value — instead it bumps a nonce that
 * every expanded node watches and collapses itself on. The reveal store drives the
 * inverse (expand down to a path); this is the one-shot collapse signal.
 */
interface FileTreeState {
  collapseNonce: number
  collapseAll: () => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  collapseNonce: 0,
  collapseAll: () => set((s) => ({ collapseNonce: s.collapseNonce + 1 })),
}))

import { create } from 'zustand'

/**
 * The single name-prompt dialog's intent (new file / new folder / rename). Both the
 * tree's right-click menu and the Files keyboard shortcuts open it through here; one
 * `FilePromptDialog` (mounted in AppShell) reads it. Cross-component UI state, so it's a
 * store — not React context (see the architecture skill).
 *
 * `openSeq` bumps on every open and keys the dialog's React mount: opening a second
 * prompt right after the first closes (new file → new folder) otherwise raced Base UI's
 * close animation, whose stale `onOpenChange(false)` clobbered the just-opened `kind`
 * back to null and the submit no-op'd. A fresh keyed mount per open has no carryover.
 */
export type FilePromptKind = 'new-file' | 'new-folder' | 'rename'

interface FilePromptState {
  kind: FilePromptKind | null
  openSeq: number
  /** Directory a new file/folder lands in (new-file / new-folder). */
  dir: string
  /** The path being renamed (rename only). */
  target: string
  /** Prefilled name shown in the input (the current basename, for rename). */
  initialName: string
  newFile: (dir: string) => void
  newFolder: (dir: string) => void
  rename: (target: string, currentName: string) => void
  close: () => void
}

export const useFilePromptStore = create<FilePromptState>((set) => ({
  kind: null,
  openSeq: 0,
  dir: '',
  target: '',
  initialName: '',
  newFile: (dir) =>
    set((s) => ({ kind: 'new-file', dir, target: '', initialName: '', openSeq: s.openSeq + 1 })),
  newFolder: (dir) =>
    set((s) => ({ kind: 'new-folder', dir, target: '', initialName: '', openSeq: s.openSeq + 1 })),
  rename: (target, currentName) =>
    set((s) => ({
      kind: 'rename',
      target,
      dir: '',
      initialName: currentName,
      openSeq: s.openSeq + 1,
    })),
  close: () => set({ kind: null }),
}))

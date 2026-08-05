import { create } from 'zustand'

/**
 * What History is reading: a commit, one file's diff inside it, or the whole commit as one
 * continuous read. `null` is the tab's resting state — the list with nothing opened yet.
 */
export type HistorySelection =
  | { kind: 'commit'; hash: string }
  | { kind: 'file'; hash: string; path: string }
  | { kind: 'all'; hash: string }
  | null

type HistoryState = {
  selection: HistorySelection
  /**
   * The last file opened inside the commit now selected — what the file timeline describes.
   *
   * Outlives the diff screen on purpose. The phone's companion opens from the list header, so
   * a timeline keyed to the file *currently* on screen could never be read there at all; this
   * keeps the file you just walked through addressable for as long as you stay in its commit,
   * and drops it the moment you move to another one.
   */
  timelinePath: string | null
  openCommit: (hash: string) => void
  openFile: (hash: string, path: string) => void
  openAll: (hash: string) => void
  /** Step back from a file or the continuous read to the commit that contains it. */
  closeFile: () => void
  clear: () => void
}

/**
 * What the History tab currently has open.
 *
 * Unlike the Changes store this is written by **both** form factors, for two different jobs.
 * On tablet it is navigation: the viewer column is a SplitView slot the route does not own, so
 * a selection is the only way to move within it. On phone navigation belongs to the route
 * stack — but the companion still has to name the commit and file being read, and a pushed
 * screen is not something a sheet can interrogate. So each phone screen reports itself here
 * while it is focused, and the companion reads one place on both.
 *
 * Deliberately not persisted: the commit you were reading before a cold start is a daemon
 * round trip away, and re-opening it would fire that read before the environment reconnects.
 */
export const useHistoryStore = create<HistoryState>()((set) => ({
  selection: null,
  timelinePath: null,
  openCommit: (hash) => {
    set((state) => ({
      selection: { hash, kind: 'commit' },
      timelinePath: state.selection?.hash === hash ? state.timelinePath : null,
    }))
  },
  openFile: (hash, path) => {
    set({ selection: { hash, kind: 'file', path }, timelinePath: path })
  },
  openAll: (hash) => {
    set((state) => ({
      selection: { hash, kind: 'all' },
      timelinePath: state.selection?.hash === hash ? state.timelinePath : null,
    }))
  },
  closeFile: () => {
    set((state) =>
      state.selection === null || state.selection.kind === 'commit'
        ? state
        : { selection: { hash: state.selection.hash, kind: 'commit' } },
    )
  },
  clear: () => {
    set({ selection: null, timelinePath: null })
  },
}))

/** The commit History is reading, whichever level of it is on screen. */
export function selectedHash(selection: HistorySelection): string | null {
  return selection === null ? null : selection.hash
}

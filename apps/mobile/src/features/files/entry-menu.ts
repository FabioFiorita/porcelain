/**
 * The row menu every path list shares: the tree, a folder opened by deep link, and search hits.
 * The labels and the action they run are decided here, together, because a row that reads
 * "Unpin" and then pins is the failure this seam exists to make testable. The sheet that shows
 * them is `show-entry-menu.ts`; this module stays free of native imports.
 */

/** Pin and hide state comes from the daemon's entry; a surface that cannot know it says so. */
export type EntryMenuState = { path: string; pinned: boolean; hidden: boolean }

export type EntryMenuAction = {
  kind: 'pin' | 'unpin' | 'hide' | 'unhide' | 'copy'
  path: string
} | null

const CANCEL = 'Cancel'

export function entryMenuOptions(entry: EntryMenuState): string[] {
  return [entry.pinned ? 'Unpin' : 'Pin', entry.hidden ? 'Unhide' : 'Hide', 'Copy path', CANCEL]
}

/** What the option at `index` does. `null` for Cancel and for anything off the end. */
export function entryMenuAction(entry: EntryMenuState, index: number): EntryMenuAction {
  if (index === 0) return { kind: entry.pinned ? 'unpin' : 'pin', path: entry.path }
  if (index === 1) return { kind: entry.hidden ? 'unhide' : 'hide', path: entry.path }
  if (index === 2) return { kind: 'copy', path: entry.path }
  return null
}

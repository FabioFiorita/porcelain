import type { FileEntry } from './use-files'

/**
 * The line under the breadcrumb: what is in this directory, and whether you are seeing all of it.
 *
 * Counted from the entries actually on screen rather than from anything the daemon reports, so
 * the sentence and the list can never disagree — with `showHidden` off, the count is of what the
 * repo's scope left visible, which is the honest thing to say about a list that hides rows.
 */
export function directorySummary(
  entries: readonly FileEntry[],
  options: { reading: boolean; showHidden: boolean },
): string {
  if (options.reading) return 'Reading directory…'
  const dirs = entries.filter((entry) => entry.kind === 'dir').length
  const files = entries.length - dirs
  return `${dirs} ${dirs === 1 ? 'folder' : 'folders'} · ${files} ${
    files === 1 ? 'file' : 'files'
  }${options.showHidden ? ' · hidden shown' : ''}`
}

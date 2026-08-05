import type { AppEvent } from '@porcelain/contracts'

/**
 * Daemon push event → the procedure names it makes stale. `Record<AppEvent, …>` is what makes a
 * new daemon event a compile error until it is mapped. Names no tab implements yet are
 * harmless: invalidating an absent key is a no-op.
 *
 * One line per entry, alphabetically sorted — every tab appends to this file, and a flat sorted
 * map is the shape that conflicts trivially.
 */
export const APP_EVENT_INVALIDATIONS: Record<AppEvent, readonly string[]> = {
  actions: ['actions'],
  board: ['boardCards'],
  comments: ['reviewComments'],
  evidence: ['loopEvidence', 'loopEvidenceHtml', 'featureReading'],
  'feature-view': ['featureView', 'featureReading', 'worktreeInbox'],
  // Content search reads file bodies, so a tree write staleness it exactly like a directory
  // listing — without these an open grep keeps showing hits in a file that no longer has them.
  'file-tree': ['readDir', 'searchFiles', 'searchCode', 'searchText', 'pinnedEntries'],
  layers: ['repoLayers'],
  scope: ['repoScope', 'pinnedEntries', 'readDir'],
  'working-tree': [
    'gitStatus',
    'gitFlow',
    'gitRangeFlow',
    'diffReading',
    'gitDiffFile',
    'gitCommitConventions',
    'gitSuggestions',
    'reviewedPaths',
    'gitHead',
    'gitLog',
    'gitFileLog',
    'readFile',
  ],
}

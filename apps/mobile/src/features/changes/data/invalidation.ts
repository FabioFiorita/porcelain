export const CHANGES_INVALIDATIONS = {
  commit: [
    'gitFlow',
    'gitDiffFile',
    'gitLog',
    'gitCommitConventions',
    'gitSuggestions',
    'reviewedPaths',
    'diffReading',
  ],
  discard: ['gitFlow', 'gitDiffFile', 'diffReading'],
  push: ['gitSuggestions', 'gitHead'],
  reviewed: ['reviewedPaths'],
  stage: ['gitFlow'],
} as const

const sharedChannel = {
  key: 'actions',
  label: 'Saved actions',
  hint: 'Named commands for this project.',
  disposition: 'shared',
  trackedPaths: ['.porcelain/actions.json'],
} as const

/** Representative Project Data wire values used by boundary tests and client mocks. */
export const projectDataContractFixtures = {
  companionDispositions: {
    input: '/synthetic/repo',
    output: [sharedChannel],
  },
  companionGitVisibility: {
    input: '/synthetic/repo',
    output: { hidden: true },
  },
  setCompanionGitVisibility: {
    input: { repoPath: '/synthetic/repo', hidden: false },
    output: { changed: true },
  },
  setCompanionDisposition: {
    input: { repoPath: '/synthetic/repo', key: 'actions', disposition: 'local' },
    output: { untracked: ['.porcelain/actions.json'], revealed: false },
  },
} as const

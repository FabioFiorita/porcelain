const sharedChannel = {
  key: 'actions',
  label: 'Saved actions',
  hint: 'Named commands for this project.',
  disposition: 'shared',
  trackedPaths: ['.porcelain/actions.json'],
} as const

const localChannel = {
  key: 'layers',
  label: 'Flow layers',
  hint: 'How files group into a story.',
  disposition: 'local',
  trackedPaths: ['.porcelain/layers.json'],
} as const

/** Representative Project Data wire values used by boundary tests and client mocks. */
export const projectDataContractFixtures = {
  companionDispositions: {
    input: '/synthetic/repo',
    output: [sharedChannel, localChannel],
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
  repoLayers: {
    input: '/synthetic/repo',
    output: {
      layers: [{ label: 'Docs', pattern: '(^|/)docs/' }],
      custom: true,
    },
  },
  setRepoLayers: {
    input: {
      repoPath: '/synthetic/repo',
      layers: [{ label: ' Docs ', pattern: '(^|/)docs/' }],
    },
    output: undefined,
  },
  migrateCompanion: {
    input: { projectId: 'project-1', path: '/synthetic/repo', dryRun: true },
    output: {
      projectId: 'project-1',
      repoPath: '/synthetic/repo',
      dryRun: true,
      ranAt: '2026-08-15T09:00:00.000Z',
      items: [
        {
          kind: 'review',
          source: '.porcelain/active-review',
          outcome: 'converted',
          createdId: 'canvas-1',
          detail: 'Canvas "Ship the review layer" (html, 1 asset(s))',
        },
        {
          kind: 'retired',
          source: '.porcelain/notes.md',
          outcome: 'unsupported',
          detail: 'repo notes are retired; agent instructions belong in AGENTS.md',
        },
      ],
      counts: { converted: 1, alreadyMigrated: 0, unsupported: 1, failed: 0 },
    },
  },
} as const

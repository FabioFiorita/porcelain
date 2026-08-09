const primaryAction = {
  id: 'action-build',
  title: 'Build',
  command: 'make build',
  order: 10,
  createdAt: 10,
  trusted: true,
} as const

const localAction = {
  id: 'action-serve',
  title: 'Serve locally',
  command: 'make serve',
  where: 'local',
  order: 20,
  createdAt: 20,
  trusted: false,
} as const

/** Representative Actions wire values used by boundary tests and client mocks. */
export const actionsContractFixtures = {
  actions: {
    input: '/synthetic/repo',
    output: [primaryAction, localAction],
  },
  trustActions: {
    input: { repoPath: '/synthetic/repo', ids: ['action-serve'] },
    output: undefined,
  },
  addAction: {
    input: {
      repoPath: '/synthetic/repo',
      title: 'Run checks',
      command: 'make check',
      where: 'local',
    },
    output: {
      id: 'action-check',
      title: 'Run checks',
      command: 'make check',
      where: 'local',
      order: 30,
      createdAt: 30,
    },
  },
  updateAction: {
    input: {
      repoPath: '/synthetic/repo',
      id: 'action-build',
      title: 'Build everything',
      command: 'make build-all',
      where: 'primary',
    },
    output: undefined,
  },
  moveAction: {
    input: { repoPath: '/synthetic/repo', id: 'action-serve', direction: 'up' },
    output: undefined,
  },
  deleteAction: {
    input: { repoPath: '/synthetic/repo', id: 'action-serve' },
    output: undefined,
  },
} as const

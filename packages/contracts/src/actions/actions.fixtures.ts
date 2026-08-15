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

const runTarget = {
  environmentId: 'env-local',
  projectId: 'proj-alpha',
  worktreeId: 'wt-alpha-main',
  path: '/synthetic/projects/alpha',
} as const

/** Representative Actions wire values used by boundary tests and client mocks. */
export const actionsContractFixtures = {
  actions: {
    input: { projectId: 'proj-alpha' },
    output: [primaryAction, localAction],
  },
  trustActions: {
    input: { projectId: 'proj-alpha', ids: ['action-serve'] },
    output: undefined,
  },
  addAction: {
    input: {
      projectId: 'proj-alpha',
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
      projectId: 'proj-alpha',
      id: 'action-build',
      title: 'Build everything',
      command: 'make build-all',
      where: 'primary',
    },
    output: undefined,
  },
  moveAction: {
    input: { projectId: 'proj-alpha', id: 'action-serve', direction: 'up' },
    output: undefined,
  },
  deleteAction: {
    input: { projectId: 'proj-alpha', id: 'action-serve' },
    output: undefined,
  },
  prepareActionRun: {
    input: { actionId: 'action-build', target: runTarget },
    output: {
      id: 'action-build',
      title: 'Build',
      command: 'make build',
      where: 'primary',
      cwd: '/synthetic/projects/alpha',
    },
  },
} as const

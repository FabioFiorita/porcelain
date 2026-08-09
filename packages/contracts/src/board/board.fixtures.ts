const todoCard = {
  id: 'card-todo',
  title: 'Plan the next step',
  status: 'todo',
  order: 10,
  createdAt: 10,
} as const

const doingCard = {
  id: 'card-doing',
  title: 'Check the current behavior',
  body: 'Keep the wire shape stable.',
  status: 'doing',
  order: 20,
  createdAt: 20,
} as const

const doneCard = {
  id: 'card-done',
  title: 'Record the result',
  status: 'done',
  order: 30,
  createdAt: 30,
} as const

/** Representative Board wire values used by boundary tests and client mocks. */
export const boardContractFixtures = {
  boardCards: {
    input: '/synthetic/repo',
    output: [todoCard, doingCard, doneCard],
  },
  addBoardCard: {
    input: {
      repoPath: '/synthetic/repo',
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing',
    },
    output: {
      id: 'card-added',
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing',
      order: 40,
      createdAt: 40,
    },
  },
  updateBoardCard: {
    input: {
      repoPath: '/synthetic/repo',
      id: 'card-todo',
      title: 'Plan the immediate next step',
      body: 'Updated body',
    },
    output: undefined,
  },
  moveBoardCard: {
    input: { repoPath: '/synthetic/repo', id: 'card-todo', status: 'done' },
    output: undefined,
  },
  deleteBoardCard: {
    input: { repoPath: '/synthetic/repo', id: 'card-done' },
    output: undefined,
  },
  clearBoardCards: {
    input: { repoPath: '/synthetic/repo', status: 'todo' },
    output: undefined,
  },
} as const

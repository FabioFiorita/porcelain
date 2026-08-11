import { defineContractFixture } from '../testing'
import {
  boardCardSchema,
  clearBoardColumnInputSchema,
  clearBoardColumnOutputSchema,
  createBoardCardInputSchema,
  createBoardCardOutputSchema,
  deleteBoardCardInputSchema,
  deleteBoardCardOutputSchema,
  listBoardCardsInputSchema,
  listBoardCardsOutputSchema,
  moveBoardCardInputSchema,
  moveBoardCardOutputSchema,
  updateBoardCardInputSchema,
  updateBoardCardOutputSchema,
} from './board.contract'
import { boardChangedSchema } from './board.notifications'

const SYNTHETIC_PROJECT = '/synthetic/repo'
const TODO_ID = '00000000-0000-4000-8000-000000000101'
const DOING_ID = '00000000-0000-4000-8000-000000000102'
const DONE_ID = '00000000-0000-4000-8000-000000000103'
const ADDED_ID = '00000000-0000-4000-8000-000000000104'

/** Schema-valid Board card for contract tests and client mocks. */
export function boardCardFixture(
  overrides: {
    id?: string
    title?: string
    body?: string
    status?: 'todo' | 'doing' | 'done'
    order?: number
    createdAt?: number
  } = {},
) {
  return defineContractFixture(boardCardSchema, {
    id: overrides.id ?? TODO_ID,
    title: overrides.title ?? 'Plan the next step',
    ...(overrides.body !== undefined ? { body: overrides.body } : {}),
    status: overrides.status ?? 'todo',
    order: overrides.order ?? 10,
    createdAt: overrides.createdAt ?? 10,
  })
}

/** Schema-valid `board.changed` notification (RT-001 envelope; refresh signal only). */
export function boardNotificationFixture(projectPath: string = SYNTHETIC_PROJECT) {
  return defineContractFixture(boardChangedSchema, {
    kind: 'board.changed',
    projectPath,
  })
}

const todoCard = boardCardFixture({
  id: TODO_ID,
  title: 'Plan the next step',
  status: 'todo',
  order: 10,
  createdAt: 10,
})

const doingCard = boardCardFixture({
  id: DOING_ID,
  title: 'Check the current behavior',
  body: 'Keep the wire shape stable.',
  status: 'doing',
  order: 20,
  createdAt: 20,
})

const doneCard = boardCardFixture({
  id: DONE_ID,
  title: 'Record the result',
  status: 'done',
  order: 30,
  createdAt: 30,
})

/**
 * Representative Board procedure input/output fixtures. Each value is parsed at construction
 * so drift fails when the fixture module loads, not when a consumer reads it.
 */
export const boardContractFixtures = {
  listBoardCards: {
    input: defineContractFixture(listBoardCardsInputSchema, SYNTHETIC_PROJECT),
    output: defineContractFixture(listBoardCardsOutputSchema, [todoCard, doingCard, doneCard]),
  },
  createBoardCard: {
    input: defineContractFixture(createBoardCardInputSchema, {
      projectPath: SYNTHETIC_PROJECT,
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing' as const,
    }),
    output: defineContractFixture(createBoardCardOutputSchema, {
      id: ADDED_ID,
      title: 'Capture the decision',
      body: 'The body is optional on the wire.',
      status: 'doing',
      order: 40,
      createdAt: 40,
    }),
  },
  updateBoardCard: {
    input: defineContractFixture(updateBoardCardInputSchema, {
      projectPath: SYNTHETIC_PROJECT,
      cardId: TODO_ID,
      title: 'Plan the immediate next step',
      body: 'Updated body',
    }),
    output: defineContractFixture(updateBoardCardOutputSchema, {
      id: TODO_ID,
      title: 'Plan the immediate next step',
      body: 'Updated body',
      status: 'todo',
      order: 10,
      createdAt: 10,
    }),
  },
  moveBoardCard: {
    input: defineContractFixture(moveBoardCardInputSchema, {
      projectPath: SYNTHETIC_PROJECT,
      cardId: TODO_ID,
      status: 'done' as const,
    }),
    output: defineContractFixture(moveBoardCardOutputSchema, {
      id: TODO_ID,
      title: 'Plan the next step',
      status: 'done',
      order: 50,
      createdAt: 10,
    }),
  },
  deleteBoardCard: {
    input: defineContractFixture(deleteBoardCardInputSchema, {
      projectPath: SYNTHETIC_PROJECT,
      cardId: DONE_ID,
    }),
    output: defineContractFixture(deleteBoardCardOutputSchema, { cardId: DONE_ID }),
  },
  clearBoardColumn: {
    input: defineContractFixture(clearBoardColumnInputSchema, {
      projectPath: SYNTHETIC_PROJECT,
      status: 'todo' as const,
    }),
    output: defineContractFixture(clearBoardColumnOutputSchema, {
      status: 'todo',
      cardIds: [TODO_ID],
    }),
  },
} as const

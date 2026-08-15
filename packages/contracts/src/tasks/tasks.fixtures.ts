import { defineContractFixture } from '../testing'
import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  deleteTaskOutputSchema,
  listTasksOutputSchema,
  type Task,
  taskSchema,
  updateTaskInputSchema,
} from './tasks.contract'
import { tasksChangedSchema } from './tasks.notifications'

const OPEN_ID = '00000000-0000-4000-8000-000000000201'
const DOING_ID = '00000000-0000-4000-8000-000000000202'
const ADDED_ID = '00000000-0000-4000-8000-000000000203'
const ATTACHMENT_ID = '00000000-0000-4000-8000-000000000210'
const PROJECT_ID = 'project-synthetic'
const WORKTREE_ID = 'worktree-synthetic'
const CREATED_AT = '2026-01-01T00:00:00.000Z'
const UPDATED_AT = '2026-01-02T00:00:00.000Z'

/** Schema-valid Task for contract tests and client mocks. */
export function taskFixture(overrides: Partial<Task> = {}): Task {
  return defineContractFixture(taskSchema, {
    id: OPEN_ID,
    title: 'Rehearse the release',
    status: 'todo',
    tags: [],
    references: {},
    attachments: [],
    links: [],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  })
}

/** Schema-valid `tasks.changed` notification (refresh signal only). */
export function tasksNotificationFixture() {
  return defineContractFixture(tasksChangedSchema, { kind: 'tasks.changed' })
}

const openTask = taskFixture()

const referencedTask = taskFixture({
  id: DOING_ID,
  title: 'Fix the flaky worktree probe',
  status: 'doing',
  tags: ['git', 'flaky'],
  references: { projectId: PROJECT_ID, worktreeId: WORKTREE_ID },
  attachments: [
    {
      id: ATTACHMENT_ID,
      name: 'trace.log',
      storedPath: `${DOING_ID}/${ATTACHMENT_ID}-trace.log`,
      byteSize: 2048,
      mime: 'text/plain',
    },
  ],
  links: [{ url: 'https://example.invalid/run/1', label: 'Failing run' }],
})

/**
 * Representative Tasks procedure input/output fixtures. Each value is parsed at construction
 * so drift fails when the fixture module loads, not when a consumer reads it.
 */
export const tasksContractFixtures = {
  listTasks: {
    input: undefined,
    output: defineContractFixture(listTasksOutputSchema, [openTask, referencedTask]),
  },
  createTask: {
    input: defineContractFixture(createTaskInputSchema, {
      title: 'Capture the follow-up',
      notes: 'Notes are markdown and optional.',
      status: 'todo' as const,
      tags: ['follow-up'],
      references: { projectId: PROJECT_ID },
      links: [{ url: 'https://example.invalid/issue/23', label: 'Issue 23' }],
    }),
    output: defineContractFixture(taskSchema, {
      ...taskFixture({ id: ADDED_ID, title: 'Capture the follow-up' }),
      notes: 'Notes are markdown and optional.',
      tags: ['follow-up'],
      references: { projectId: PROJECT_ID },
      links: [{ url: 'https://example.invalid/issue/23', label: 'Issue 23' }],
    }),
  },
  updateTask: {
    input: defineContractFixture(updateTaskInputSchema, {
      taskId: OPEN_ID,
      status: 'done' as const,
      tags: ['release'],
    }),
    output: defineContractFixture(taskSchema, {
      ...openTask,
      status: 'done',
      tags: ['release'],
    }),
  },
  deleteTask: {
    input: defineContractFixture(deleteTaskInputSchema, { taskId: DOING_ID }),
    output: defineContractFixture(deleteTaskOutputSchema, { taskId: DOING_ID }),
  },
} as const

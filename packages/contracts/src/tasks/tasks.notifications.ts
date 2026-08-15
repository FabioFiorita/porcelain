import { z } from 'zod'

/**
 * Tasks change notification.
 *
 * The table is daemon-wide, so — unlike `board.changed` — there is no path or scope to
 * carry: one flat "the Tasks on this daemon are stale" signal says everything a client
 * needs, and the list query stays authoritative for the rows themselves.
 */

export const TASKS_CHANGE_KINDS = ['tasks.changed'] as const

export const tasksChangedSchema = z.object({ kind: z.literal('tasks.changed') }).strict()
export type TasksChanged = z.infer<typeof tasksChangedSchema>

export const tasksChangeSchema = z.discriminatedUnion('kind', [tasksChangedSchema])
export type TasksChange = z.infer<typeof tasksChangeSchema>

/** Representative Tasks change value used by boundary tests and client mocks. */
export const tasksNotificationFixtures = {
  'tasks.changed': { kind: 'tasks.changed' },
} as const

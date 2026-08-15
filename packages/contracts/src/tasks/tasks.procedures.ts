import type { ProcedureContract } from '../procedure-contract'
import {
  createTaskInputSchema,
  createTaskOutputSchema,
  deleteTaskInputSchema,
  deleteTaskOutputSchema,
  listTasksInputSchema,
  listTasksOutputSchema,
  updateTaskInputSchema,
  updateTaskOutputSchema,
} from './tasks.contract'

/**
 * Canonical Tasks procedure declarations.
 *
 * These four names are the public Tasks wire vocabulary and the live catalog members
 * composed into `procedureCatalog`. Inline `name: { kind }` entries keep the
 * procedure-contract lint's domain-record scanner honest.
 */

export const tasksProcedures = {
  listTasks: {
    kind: 'query',
    input: listTasksInputSchema,
    output: listTasksOutputSchema,
    errors: ['tasks.unavailable'],
  },
  createTask: {
    kind: 'mutation',
    input: createTaskInputSchema,
    output: createTaskOutputSchema,
    errors: ['tasks.unavailable', 'tasks.invalid-title', 'tasks.attachment-rejected'],
  },
  updateTask: {
    kind: 'mutation',
    input: updateTaskInputSchema,
    output: updateTaskOutputSchema,
    errors: ['tasks.unavailable', 'tasks.not-found', 'tasks.invalid-title'],
  },
  deleteTask: {
    kind: 'mutation',
    input: deleteTaskInputSchema,
    output: deleteTaskOutputSchema,
    errors: ['tasks.unavailable', 'tasks.not-found'],
  },
} as const satisfies Record<string, ProcedureContract>

export type TasksProcedureName = keyof typeof tasksProcedures

export const listTasksProcedure = tasksProcedures.listTasks
export const createTaskProcedure = tasksProcedures.createTask
export const updateTaskProcedure = tasksProcedures.updateTask
export const deleteTaskProcedure = tasksProcedures.deleteTask

import type { ProcedureContract } from '../procedure-contract'
import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  deleteTaskOutputSchema,
  getTaskAttachmentInputSchema,
  getTaskAttachmentOutputSchema,
  listTasksInputSchema,
  listTasksOutputSchema,
  taskSchema,
  updateTaskInputSchema,
} from './tasks.contract'

/**
 * Canonical Tasks procedure declarations.
 *
 * These five names are the public Tasks wire vocabulary and the live catalog members
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
    output: taskSchema,
    errors: ['tasks.unavailable', 'tasks.invalid-title', 'tasks.attachment-rejected'],
  },
  updateTask: {
    kind: 'mutation',
    input: updateTaskInputSchema,
    output: taskSchema,
    errors: ['tasks.unavailable', 'tasks.not-found', 'tasks.invalid-title'],
  },
  deleteTask: {
    kind: 'mutation',
    input: deleteTaskInputSchema,
    output: deleteTaskOutputSchema,
    errors: ['tasks.unavailable', 'tasks.not-found'],
  },
  getTaskAttachment: {
    kind: 'query',
    input: getTaskAttachmentInputSchema,
    output: getTaskAttachmentOutputSchema,
    errors: ['tasks.unavailable', 'tasks.not-found', 'tasks.attachment-rejected'],
  },
} as const satisfies Record<string, ProcedureContract>

export type TasksProcedureName = keyof typeof tasksProcedures

export const listTasksProcedure = tasksProcedures.listTasks
export const createTaskProcedure = tasksProcedures.createTask
export const updateTaskProcedure = tasksProcedures.updateTask
export const deleteTaskProcedure = tasksProcedures.deleteTask
export const getTaskAttachmentProcedure = tasksProcedures.getTaskAttachment

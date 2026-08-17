import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { TasksResult } from './tasks-capabilities'
import type { TasksOperations } from './tasks-operations'

/**
 * Tasks feature router — five canonical wire names bound to `tasksProcedures`.
 * Each procedure is parse → invoke one operation → map authoritative outputs.
 */

function throwIfFailed<T>(result: TasksResult<T>): T {
  if (result.ok) return result.value
  const error = result.error
  if (error.code === 'tasks.not-found') {
    throw toTrpcError(expectedFailure('tasks.not-found', { taskId: error.taskId }))
  }
  if (error.code === 'tasks.invalid-title') {
    throw toTrpcError(
      expectedFailure('tasks.invalid-title', {
        reason: error.reason,
        maxLength: error.maxLength,
      }),
    )
  }
  if (error.code === 'tasks.attachment-rejected') {
    throw toTrpcError(expectedFailure('tasks.attachment-rejected', { reason: error.reason }))
  }
  throw toTrpcError(expectedFailure('tasks.unavailable'))
}

export function createTasksRouter(operations: TasksOperations) {
  return t.router({
    listTasks: publicProcedure
      .input(procedureCatalog.listTasks.input)
      .output(procedureCatalog.listTasks.output)
      .query(async () => {
        return throwIfFailed(await operations.listTasks())
      }),

    createTask: publicProcedure
      .input(procedureCatalog.createTask.input)
      .output(procedureCatalog.createTask.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(
          await operations.createTask({
            title: input.title,
            notes: input.notes,
            status: input.status,
            tags: input.tags,
            references: input.references,
            links: input.links,
            pathRefs: input.pathRefs,
            attachmentPaths: input.attachmentPaths,
            attachmentUploads: input.attachmentUploads,
          }),
        )
      }),

    updateTask: publicProcedure
      .input(procedureCatalog.updateTask.input)
      .output(procedureCatalog.updateTask.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(
          await operations.updateTask({
            taskId: input.taskId,
            title: input.title,
            notes: input.notes,
            status: input.status,
            tags: input.tags,
            references: input.references,
            links: input.links,
            pathRefs: input.pathRefs,
            attachmentPaths: input.attachmentPaths,
            attachmentUploads: input.attachmentUploads,
            removeAttachmentIds: input.removeAttachmentIds,
          }),
        )
      }),

    deleteTask: publicProcedure
      .input(procedureCatalog.deleteTask.input)
      .output(procedureCatalog.deleteTask.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(await operations.deleteTask({ taskId: input.taskId }))
      }),

    getTaskAttachment: publicProcedure
      .input(procedureCatalog.getTaskAttachment.input)
      .output(procedureCatalog.getTaskAttachment.output)
      .query(async ({ input }) => {
        return throwIfFailed(await operations.getTaskAttachment(input))
      }),
  })
}

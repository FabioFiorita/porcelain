import type { TaskAttachmentUpload, TaskPathRef } from '@porcelain/contracts/tasks'
import type {
  Task,
  TaskAttachment,
  TaskLink,
  TaskReferences,
  TasksAttachments,
  TasksChanges,
  TasksClock,
  TasksResult,
  TasksStore,
} from './tasks-capabilities'
import { decodeAttachmentUpload, normalizeLinks, normalizeTags, validateTitle } from './tasks-rules'

export type UpdateTaskInput = {
  taskId: string
  title?: string
  notes?: string
  status?: Task['status']
  tags?: readonly string[]
  references?: TaskReferences
  links?: readonly TaskLink[]
  pathRefs?: readonly TaskPathRef[]
  attachmentPaths?: readonly string[]
  attachmentUploads?: readonly TaskAttachmentUpload[]
  removeAttachmentIds?: readonly string[]
}

/** Edit a row in place. New attachments are copied first; a failed write drops only those. */
export function createUpdateTask(deps: {
  store: TasksStore
  clock: TasksClock
  attachments: TasksAttachments
  changes: TasksChanges
}) {
  return async function updateTask(input: UpdateTaskInput): Promise<TasksResult<Task>> {
    let title: string | undefined
    if (input.title !== undefined) {
      const validated = validateTitle(input.title)
      if (!validated.ok) return validated
      title = validated.value
    }
    const now = deps.clock.now()

    const added: TaskAttachment[] = []
    for (const sourcePath of input.attachmentPaths ?? []) {
      const attachment = await deps.attachments.copyInto(input.taskId, sourcePath)
      if (!attachment.ok) {
        await dropAdded(deps.attachments, added)
        return attachment
      }
      added.push(attachment.value)
    }
    for (const upload of input.attachmentUploads ?? []) {
      const decoded = decodeAttachmentUpload(upload.contentBase64)
      if (!decoded.ok) {
        await dropAdded(deps.attachments, added)
        return decoded
      }
      const attachment = await deps.attachments.writeBytes(input.taskId, upload.name, decoded.value)
      if (!attachment.ok) {
        await dropAdded(deps.attachments, added)
        return attachment
      }
      added.push(attachment.value)
    }

    const written = await deps.store.transact((current) => {
      const existing = current.find((task) => task.id === input.taskId)
      if (existing === undefined) {
        return { ok: false, error: { code: 'tasks.not-found', taskId: input.taskId } }
      }
      const remove = new Set(input.removeAttachmentIds ?? [])
      const kept = existing.attachments.filter((attachment) => !remove.has(attachment.id))
      const next: Task = {
        ...existing,
        ...(title !== undefined ? { title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
        ...(input.references !== undefined ? { references: input.references } : {}),
        ...(input.links !== undefined ? { links: normalizeLinks(input.links) } : {}),
        ...(input.pathRefs !== undefined ? { pathRefs: [...input.pathRefs] } : {}),
        attachments: [...kept, ...added],
        updatedAt: now,
      }
      return {
        ok: true,
        value: {
          tasks: current.map((task) => (task.id === next.id ? next : task)),
          value: {
            task: next,
            removed: existing.attachments.filter((item) => remove.has(item.id)),
          },
        },
      }
    })
    if (!written.ok) {
      await dropAdded(deps.attachments, added)
      return written
    }

    for (const attachment of written.value.removed) {
      await deps.attachments.removeOne(attachment.storedPath)
    }
    deps.changes.publish({ type: 'tasks.changed' })
    return { ok: true, value: written.value.task }
  }
}

async function dropAdded(attachments: TasksAttachments, added: readonly TaskAttachment[]) {
  for (const attachment of added) await attachments.removeOne(attachment.storedPath)
}

export type UpdateTask = ReturnType<typeof createUpdateTask>

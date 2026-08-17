import type { TaskAttachmentUpload, TaskPathRef } from '@porcelain/contracts/tasks'
import { nextTaskShortId } from '@shared/tasks-porcelain'
import type {
  Task,
  TaskAttachment,
  TaskLink,
  TaskReferences,
  TasksAttachments,
  TasksChanges,
  TasksClock,
  TasksIds,
  TasksResult,
  TasksStore,
} from './tasks-capabilities'
import {
  decodeAttachmentUpload,
  defaultStatus,
  normalizeLinks,
  normalizeTags,
  validateTitle,
} from './tasks-rules'

export type CreateTaskInput = {
  title: string
  notes?: string
  status?: Task['status']
  tags?: readonly string[]
  references?: TaskReferences
  links?: readonly TaskLink[]
  pathRefs?: readonly TaskPathRef[]
  /** Absolute host paths copied into this daemon's attachment store before the row lands. */
  attachmentPaths?: readonly string[]
  /** Pasted or uploaded bytes the daemon copies into the same store. */
  attachmentUploads?: readonly TaskAttachmentUpload[]
}

/**
 * Quick Add. Attachments are copied BEFORE the row is written, and a copy the adapter
 * refuses aborts the whole create — a Task that claims an attachment it does not have is
 * worse than no Task at all. A failed durable write discards whatever was already copied,
 * so the store never accumulates orphans.
 */
export function createCreateTask(deps: {
  store: TasksStore
  clock: TasksClock
  ids: TasksIds
  attachments: TasksAttachments
  changes: TasksChanges
}) {
  return async function createTask(input: CreateTaskInput): Promise<TasksResult<Task>> {
    const title = validateTitle(input.title)
    if (!title.ok) return title

    const id = deps.ids.create()
    const now = deps.clock.now()

    const copied: TaskAttachment[] = []
    for (const sourcePath of input.attachmentPaths ?? []) {
      const attachment = await deps.attachments.copyInto(id, sourcePath)
      if (!attachment.ok) {
        await deps.attachments.discard(id)
        return attachment
      }
      copied.push(attachment.value)
    }
    for (const upload of input.attachmentUploads ?? []) {
      const decoded = decodeAttachmentUpload(upload.contentBase64)
      if (!decoded.ok) {
        await deps.attachments.discard(id)
        return decoded
      }
      const attachment = await deps.attachments.writeBytes(id, upload.name, decoded.value)
      if (!attachment.ok) {
        await deps.attachments.discard(id)
        return attachment
      }
      copied.push(attachment.value)
    }

    const written = await deps.store.transact((current) => {
      const task: Task = {
        id,
        shortId: nextTaskShortId(current),
        title: title.value,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        status: defaultStatus(input.status),
        tags: normalizeTags(input.tags ?? []),
        references: input.references ?? {},
        pathRefs: [...(input.pathRefs ?? [])],
        attachments: copied,
        links: normalizeLinks(input.links ?? []),
        createdAt: now,
        updatedAt: now,
      }
      return { ok: true, value: { tasks: [...current, task], value: task } }
    })
    if (!written.ok) {
      await deps.attachments.discard(id)
      return written
    }

    deps.changes.publish({ type: 'tasks.changed' })
    return written
  }
}

export type CreateTask = ReturnType<typeof createCreateTask>

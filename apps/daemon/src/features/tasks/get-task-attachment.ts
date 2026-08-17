import type { GetTaskAttachmentOutput } from '@porcelain/contracts/tasks'
import type { TasksAttachments, TasksResult, TasksStore } from './tasks-capabilities'

export type GetTaskAttachmentInput = {
  taskId: string
  attachmentId: string
}

/** Bytes for one stored attachment, as a data URL the viewer can render. */
export function createGetTaskAttachment(deps: {
  store: TasksStore
  attachments: TasksAttachments
}) {
  return async function getTaskAttachment(
    input: GetTaskAttachmentInput,
  ): Promise<TasksResult<GetTaskAttachmentOutput>> {
    const read = await deps.store.read()
    if (!read.ok) return read
    const task = read.value.find((row) => row.id === input.taskId)
    if (task === undefined) {
      return { ok: false, error: { code: 'tasks.not-found', taskId: input.taskId } }
    }
    const attachment = task.attachments.find((item) => item.id === input.attachmentId)
    if (attachment === undefined) {
      return { ok: false, error: { code: 'tasks.attachment-rejected', reason: 'not-found' } }
    }
    const bytes = await deps.attachments.read(attachment.storedPath)
    if (!bytes.ok) return bytes
    const dataUrl = `data:${attachment.mime};base64,${Buffer.from(bytes.value).toString('base64')}`
    return {
      ok: true,
      value: {
        id: attachment.id,
        name: attachment.name,
        mime: attachment.mime,
        byteSize: attachment.byteSize,
        dataUrl,
      },
    }
  }
}

export type GetTaskAttachment = ReturnType<typeof createGetTaskAttachment>

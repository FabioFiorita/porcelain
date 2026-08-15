import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, realpath, rm, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isInsideDir } from '@shared/canvas-porcelain'
import {
  safeTaskAttachmentName,
  TASK_ATTACHMENT_MAX_BYTES,
  taskAttachmentMime,
  taskAttachmentsDir,
  tasksAttachmentsRoot,
} from '@shared/tasks-porcelain'
import type {
  TaskAttachment,
  TasksAttachmentRejectedReason,
  TasksAttachments,
  TasksResult,
} from './tasks-capabilities'

function rejected(reason: TasksAttachmentRejectedReason): TasksResult<never> {
  return { ok: false, error: { code: 'tasks.attachment-rejected', reason } }
}

/**
 * Copies Quick Add sources into `$PORCELAIN_HOME/tasks/attachments/<taskId>/`.
 *
 * The daemon OWNS the destination: the stored name is the source's basename with every
 * directory component stripped, prefixed by a freshly minted id, and the resulting path is
 * re-checked against the attachment root AFTER symlinks are resolved — so neither a crafted
 * file name nor a symlinked attachment directory can place a copy outside the store. The
 * source itself is realpath'd and required to be a regular file, so a symlink pointing at a
 * device or a directory is refused instead of being read as content.
 */
export function createTasksAttachments(options: {
  homeDir: string
  maxBytes?: number
}): TasksAttachments {
  const maxBytes = options.maxBytes ?? TASK_ATTACHMENT_MAX_BYTES
  const root = resolve(tasksAttachmentsRoot(options.homeDir))

  return Object.freeze({
    async copyInto(taskId: string, sourcePath: string): Promise<TasksResult<TaskAttachment>> {
      if (!isAbsolute(sourcePath)) return rejected('not-absolute')
      const storedName = safeTaskAttachmentName(sourcePath)
      if (storedName === null) return rejected('unsafe-name')

      let sourceReal: string
      try {
        sourceReal = await realpath(sourcePath)
      } catch {
        return rejected('not-found')
      }
      let info: Awaited<ReturnType<typeof stat>>
      try {
        info = await stat(sourceReal)
      } catch {
        return rejected('not-found')
      }
      if (!info.isFile()) return rejected('not-a-file')
      if (info.size > maxBytes) return rejected('too-large')

      const attachmentId = randomUUID()
      const taskDirLexical = resolve(taskAttachmentsDir(options.homeDir, taskId))
      if (!isInsideDir(root, taskDirLexical)) return rejected('unsafe-name')
      const destinationLexical = resolve(taskDirLexical, `${attachmentId}-${storedName}`)
      if (!isInsideDir(taskDirLexical, destinationLexical)) return rejected('unsafe-name')

      try {
        await mkdir(taskDirLexical, { recursive: true })
        // The directory may already exist as (or through) a symlink; resolving it and
        // re-checking is what stops a pre-planted link from redirecting the copy.
        const taskDirReal = await realpath(taskDirLexical)
        const rootReal = await realpath(root)
        if (!isInsideDir(rootReal, taskDirReal)) return rejected('unsafe-name')
        await copyFile(sourceReal, resolve(taskDirReal, `${attachmentId}-${storedName}`))
        return {
          ok: true,
          value: {
            id: attachmentId,
            name: storedName,
            storedPath: relative(rootReal, resolve(taskDirReal, `${attachmentId}-${storedName}`))
              .split(sep)
              .join('/'),
            byteSize: info.size,
            mime: taskAttachmentMime(storedName),
          },
        }
      } catch {
        return { ok: false, error: { code: 'tasks.unavailable' } }
      }
    },

    async discard(taskId: string): Promise<void> {
      const taskDirLexical = resolve(taskAttachmentsDir(options.homeDir, taskId))
      if (!isInsideDir(root, taskDirLexical)) return
      try {
        await rm(taskDirLexical, { recursive: true, force: true })
      } catch (error) {
        // Best effort by design — the row is already gone, so leftover bytes must not fail
        // the caller — but the failure gets an owner instead of vanishing.
        console.error(`porcelain: could not discard task attachments for ${taskId}`, error)
      }
    },
  })
}

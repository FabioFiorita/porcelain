import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isInsideDir } from '@shared/canvas-porcelain'
import {
  safeTaskAttachmentName,
  TASK_ATTACHMENT_MAX_BYTES,
  taskAttachmentMime,
  taskAttachmentPath,
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
 * Copies sources and pasted bytes into `$PORCELAIN_HOME/tasks/attachments/<taskId>/`.
 *
 * The daemon OWNS the destination: the stored name is the source's basename with every
 * directory component stripped, prefixed by a freshly minted id, and the resulting path is
 * re-checked against the attachment root AFTER symlinks are resolved — so neither a crafted
 * file name nor a symlinked attachment directory can place a copy outside the store.
 */
export function createTasksAttachments(options: {
  homeDir: string
  maxBytes?: number
}): TasksAttachments {
  const maxBytes = options.maxBytes ?? TASK_ATTACHMENT_MAX_BYTES
  const root = resolve(tasksAttachmentsRoot(options.homeDir))

  async function place(
    taskId: string,
    storedName: string,
    write: (destination: string) => Promise<number>,
  ): Promise<TasksResult<TaskAttachment>> {
    const attachmentId = randomUUID()
    const taskDirLexical = resolve(taskAttachmentsDir(options.homeDir, taskId))
    if (!isInsideDir(root, taskDirLexical)) return rejected('unsafe-name')
    const destinationLexical = resolve(taskDirLexical, `${attachmentId}-${storedName}`)
    if (!isInsideDir(taskDirLexical, destinationLexical)) return rejected('unsafe-name')

    try {
      await mkdir(taskDirLexical, { recursive: true })
      const taskDirReal = await realpath(taskDirLexical)
      const rootReal = await realpath(root)
      if (!isInsideDir(rootReal, taskDirReal)) return rejected('unsafe-name')
      const destination = resolve(taskDirReal, `${attachmentId}-${storedName}`)
      const byteSize = await write(destination)
      return {
        ok: true,
        value: {
          id: attachmentId,
          name: storedName,
          storedPath: relative(rootReal, destination).split(sep).join('/'),
          byteSize,
          mime: taskAttachmentMime(storedName),
        },
      }
    } catch {
      return { ok: false, error: { code: 'tasks.unavailable' } }
    }
  }

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

      return place(taskId, storedName, async (destination) => {
        await copyFile(sourceReal, destination)
        return info.size
      })
    },

    async writeBytes(
      taskId: string,
      name: string,
      bytes: Uint8Array,
    ): Promise<TasksResult<TaskAttachment>> {
      const storedName = safeTaskAttachmentName(name)
      if (storedName === null) return rejected('unsafe-name')
      if (bytes.byteLength > maxBytes) return rejected('too-large')
      return place(taskId, storedName, async (destination) => {
        await writeFile(destination, bytes)
        return bytes.byteLength
      })
    },

    async read(storedPath: string): Promise<TasksResult<Uint8Array>> {
      if (storedPath === '' || storedPath.includes('\0') || storedPath.includes('..')) {
        return rejected('unsafe-name')
      }
      const lexical = resolve(taskAttachmentPath(options.homeDir, storedPath))
      if (!isInsideDir(root, lexical)) return rejected('unsafe-name')
      try {
        const real = await realpath(lexical)
        const rootReal = await realpath(root)
        if (!isInsideDir(rootReal, real)) return rejected('unsafe-name')
        const info = await stat(real)
        if (!info.isFile()) return rejected('not-a-file')
        return { ok: true, value: await readFile(real) }
      } catch {
        return rejected('not-found')
      }
    },

    async removeOne(storedPath: string): Promise<void> {
      if (storedPath === '' || storedPath.includes('\0') || storedPath.includes('..')) return
      const lexical = resolve(taskAttachmentPath(options.homeDir, storedPath))
      if (!isInsideDir(root, lexical)) return
      try {
        const real = await realpath(lexical)
        const rootReal = await realpath(root)
        if (!isInsideDir(rootReal, real)) return
        await rm(real, { force: true })
      } catch (error) {
        console.error(`porcelain: could not remove task attachment ${storedPath}`, error)
      }
    },

    async discard(taskId: string): Promise<void> {
      const taskDirLexical = resolve(taskAttachmentsDir(options.homeDir, taskId))
      if (!isInsideDir(root, taskDirLexical)) return
      try {
        await rm(taskDirLexical, { recursive: true, force: true })
      } catch (error) {
        console.error(`porcelain: could not discard task attachments for ${taskId}`, error)
      }
    },
  })
}

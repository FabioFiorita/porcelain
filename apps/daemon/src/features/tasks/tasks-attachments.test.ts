// @vitest-environment node
import { lstat, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  taskAttachmentPath,
  taskAttachmentsDir,
  tasksAttachmentsRoot,
} from '@shared/tasks-porcelain'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createTasksAttachments } from './tasks-attachments'
import type { TasksAttachmentRejectedReason } from './tasks-capabilities'

const TASK_ID = '00000000-0000-4000-8000-0000000003a1'
const OTHER_TASK_ID = '00000000-0000-4000-8000-0000000003b2'

type Fixture = { homeDir: string; outside: string }

async function withFixture(
  prefix: string,
  run: (fixture: Fixture) => Promise<void>,
): Promise<void> {
  await withTemporaryDirectory(prefix, async (directory) => {
    const homeDir = join(directory, 'home')
    const outside = join(directory, 'outside')
    await mkdir(homeDir, { recursive: true })
    await mkdir(outside, { recursive: true })
    await run({ homeDir, outside })
  })
}

function expectRejected(
  result: Awaited<ReturnType<ReturnType<typeof createTasksAttachments>['copyInto']>>,
  reason: TasksAttachmentRejectedReason,
): void {
  expect(result).toEqual({
    ok: false,
    error: { code: 'tasks.attachment-rejected', reason },
  })
}

/** Every entry under the attachments root, so an escape shows up as an absence there. */
async function listStore(homeDir: string): Promise<string[]> {
  try {
    return await readdir(tasksAttachmentsRoot(homeDir), { recursive: true })
  } catch {
    return []
  }
}

describe('createTasksAttachments', () => {
  it('copies a source under the task directory and reports a store-relative path', async () => {
    await withFixture('porcelain-tasks-attach-copy-', async ({ homeDir, outside }) => {
      const source = join(outside, 'trace.log')
      await writeFile(source, 'copied bytes', 'utf8')
      const attachments = createTasksAttachments({ homeDir })

      const result = await attachments.copyInto(TASK_ID, source)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value).toMatchObject({
        name: 'trace.log',
        byteSize: 'copied bytes'.length,
        mime: 'text/plain',
      })
      expect(result.value.storedPath).toBe(`${TASK_ID}/${result.value.id}-trace.log`)
      expect(result.value.storedPath.startsWith('/')).toBe(false)

      const stored = taskAttachmentPath(homeDir, result.value.storedPath)
      expect(await readFile(stored, 'utf8')).toBe('copied bytes')
      expect(await readdir(taskAttachmentsDir(homeDir, TASK_ID))).toEqual([
        `${result.value.id}-trace.log`,
      ])
    })
  })

  it('rejects a relative source path as not-absolute', async () => {
    await withFixture('porcelain-tasks-attach-relative-', async ({ homeDir }) => {
      const attachments = createTasksAttachments({ homeDir })
      expectRejected(await attachments.copyInto(TASK_ID, 'notes/trace.log'), 'not-absolute')
      expect(await listStore(homeDir)).toEqual([])
    })
  })

  it('rejects a missing source as not-found', async () => {
    await withFixture('porcelain-tasks-attach-missing-', async ({ homeDir, outside }) => {
      const attachments = createTasksAttachments({ homeDir })
      expectRejected(await attachments.copyInto(TASK_ID, join(outside, 'gone.log')), 'not-found')
      expect(await listStore(homeDir)).toEqual([])
    })
  })

  it('rejects a directory source as not-a-file', async () => {
    await withFixture('porcelain-tasks-attach-directory-', async ({ homeDir, outside }) => {
      const source = join(outside, 'bundle')
      await mkdir(source, { recursive: true })
      const attachments = createTasksAttachments({ homeDir })

      expectRejected(await attachments.copyInto(TASK_ID, source), 'not-a-file')
      expect(await listStore(homeDir)).toEqual([])
    })
  })

  it('rejects a symlink that resolves to a directory as not-a-file', async () => {
    await withFixture('porcelain-tasks-attach-dirlink-', async ({ homeDir, outside }) => {
      const target = join(outside, 'bundle')
      await mkdir(target, { recursive: true })
      const link = join(outside, 'bundle.link')
      await symlink(target, link)
      const attachments = createTasksAttachments({ homeDir })

      expectRejected(await attachments.copyInto(TASK_ID, link), 'not-a-file')
      expect(await listStore(homeDir)).toEqual([])
    })
  })

  it('copies a symlink to an outside regular file by value, leaving the original alone', async () => {
    await withFixture('porcelain-tasks-attach-filelink-', async ({ homeDir, outside }) => {
      const target = join(outside, 'secret.txt')
      await writeFile(target, 'original bytes', 'utf8')
      const link = join(outside, 'secret.link.txt')
      await symlink(target, link)
      const attachments = createTasksAttachments({ homeDir })

      const result = await attachments.copyInto(TASK_ID, link)
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const stored = taskAttachmentPath(homeDir, result.value.storedPath)
      const storedStat = await lstat(stored)
      expect(storedStat.isSymbolicLink()).toBe(false)
      expect(storedStat.isFile()).toBe(true)
      expect(await readFile(stored, 'utf8')).toBe('original bytes')

      // Writing through the store must not reach back out to the source.
      await writeFile(stored, 'rewritten in store', 'utf8')
      expect(await readFile(target, 'utf8')).toBe('original bytes')
      expect((await lstat(link)).isSymbolicLink()).toBe(true)
    })
  })

  it('rejects a source larger than the configured bound as too-large', async () => {
    await withFixture('porcelain-tasks-attach-large-', async ({ homeDir, outside }) => {
      const source = join(outside, 'big.bin')
      await writeFile(source, 'x'.repeat(64), 'utf8')
      const attachments = createTasksAttachments({ homeDir, maxBytes: 8 })

      expectRejected(await attachments.copyInto(TASK_ID, source), 'too-large')
      expect(await listStore(homeDir)).toEqual([])
    })
  })

  it('rejects dot, dot-dot, empty, and NUL base names without writing anywhere', async () => {
    await withFixture('porcelain-tasks-attach-names-', async ({ homeDir, outside }) => {
      await writeFile(join(outside, 'real.txt'), 'bytes', 'utf8')
      const attachments = createTasksAttachments({ homeDir })

      for (const sourcePath of [`${outside}/..`, `${outside}/.`, '/', `${outside}/re\0al.txt`]) {
        expectRejected(await attachments.copyInto(TASK_ID, sourcePath), 'unsafe-name')
      }

      expect(await listStore(homeDir)).toEqual([])
      expect(await readdir(outside)).toEqual(['real.txt'])
    })
  })

  it('refuses to copy through a task directory pre-planted as an escaping symlink', async () => {
    await withFixture('porcelain-tasks-attach-plantedlink-', async ({ homeDir, outside }) => {
      const escapeTarget = join(outside, 'escape')
      await mkdir(escapeTarget, { recursive: true })
      await mkdir(tasksAttachmentsRoot(homeDir), { recursive: true })
      await symlink(escapeTarget, taskAttachmentsDir(homeDir, TASK_ID))

      const source = join(outside, 'payload.txt')
      await writeFile(source, 'payload bytes', 'utf8')
      const attachments = createTasksAttachments({ homeDir })

      expectRejected(await attachments.copyInto(TASK_ID, source), 'unsafe-name')
      expect(await readdir(escapeTarget)).toEqual([])
    })
  })

  it('discards only the requested task directory', async () => {
    await withFixture('porcelain-tasks-attach-discard-', async ({ homeDir, outside }) => {
      const source = join(outside, 'note.md')
      await writeFile(source, 'kept', 'utf8')
      const attachments = createTasksAttachments({ homeDir })
      const kept = await attachments.copyInto(OTHER_TASK_ID, source)
      const dropped = await attachments.copyInto(TASK_ID, source)
      expect([kept.ok, dropped.ok]).toEqual([true, true])

      await attachments.discard(TASK_ID)

      expect(await readdir(tasksAttachmentsRoot(homeDir))).toEqual([OTHER_TASK_ID])
      expect(await readdir(taskAttachmentsDir(homeDir, OTHER_TASK_ID))).toHaveLength(1)
    })
  })

  it('discarding a task that stored nothing is a no-op', async () => {
    await withFixture('porcelain-tasks-attach-discard-empty-', async ({ homeDir }) => {
      const attachments = createTasksAttachments({ homeDir })
      await attachments.discard(TASK_ID)
      expect(await listStore(homeDir)).toEqual([])
    })
  })
})

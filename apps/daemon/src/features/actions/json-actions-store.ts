import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  ACTIONS_FILE_MAX_BYTES,
  ActionsFileParseError,
  type ActionsFileV1,
  emptyActionsFileV1,
  parseActionsFileV1,
  serializeActionsFileV1,
} from '@porcelain/shared/actions-file'
import { projectActionsPath } from '@shared/project-store'
import type { ActionsStore, ActionsStoreResult, ActionsTransactResult } from './actions-ports'

export { ACTIONS_FILE_MAX_BYTES }

let tempNameCounter = 0

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isEnoent(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function isBlank(value: string): boolean {
  return value.trim() === ''
}

function corruptTimestamp(): string {
  return new Date().toISOString().replaceAll(':', '-')
}

async function moveToCorruptBackup(sourcePath: string): Promise<string> {
  const stamp = corruptTimestamp()
  let attempt = 0
  for (;;) {
    const backupPath =
      attempt === 0 ? `${sourcePath}.corrupt-${stamp}` : `${sourcePath}.corrupt-${stamp}-${attempt}`
    try {
      await stat(backupPath)
      attempt += 1
      continue
    } catch (error) {
      if (!isEnoent(error)) throw error
    }
    await rename(sourcePath, backupPath)
    return backupPath
  }
}

async function fsyncPath(targetPath: string): Promise<void> {
  const handle = await open(targetPath, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * JSON Actions store: one strict v1 document per Project, at
 * `<homeDir>/projects/<projectId>/actions.json`. Serialized
 * read-modify-write, atomic temp+rename, corruption backup, size bound.
 *
 * The document is daemon-owned, not repo-local: it must survive `git worktree remove`
 * of the checkout an agent authored it from, and opening a repository must never add
 * application state to someone's working tree.
 */
export function createJsonActionsStore(options: {
  homeDir: string
  maxBytes?: number
}): ActionsStore {
  const maxBytes = options.maxBytes ?? ACTIONS_FILE_MAX_BYTES
  const chains = new Map<string, Promise<void>>()

  async function readDocument(projectId: string): Promise<ActionsStoreResult<ActionsFileV1>> {
    if (isBlank(projectId)) {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }
    const path = projectActionsPath(options.homeDir, projectId)

    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(path)
    } catch (error) {
      if (isEnoent(error)) return { ok: true, value: emptyActionsFileV1() }
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    if (fileStat.size > maxBytes) {
      console.error(
        `porcelain: ${path} is ${fileStat.size} bytes (> ${maxBytes}); actions unavailable`,
      )
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if (isEnoent(error)) return { ok: true, value: emptyActionsFileV1() }
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { ok: false, error: { code: 'actions.unavailable' } }
      }
      return { ok: false, error: { code: 'actions.unavailable' } }
    }

    try {
      return { ok: true, value: parseActionsFileV1(parsed) }
    } catch (error) {
      if (error instanceof ActionsFileParseError && error.code === 'incompatible-version') {
        // Leave the file in place — do not coerce or delete real data.
        return { ok: false, error: { code: 'actions.unavailable' } }
      }
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { ok: false, error: { code: 'actions.unavailable' } }
      }
      return { ok: false, error: { code: 'actions.unavailable' } }
    }
  }

  async function writeDocument(
    projectId: string,
    file: ActionsFileV1,
  ): Promise<ActionsStoreResult<void>> {
    if (isBlank(projectId)) {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }
    try {
      const path = projectActionsPath(options.homeDir, projectId)
      const parent = dirname(path)
      await mkdir(parent, { recursive: true })
      tempNameCounter += 1
      const tmpPath = join(parent, `.tmp-actions-${tempNameCounter}`)
      const body = serializeActionsFileV1(file)

      const handle = await open(tmpPath, 'wx', 0o600)
      try {
        await handle.writeFile(body, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }

      await rename(tmpPath, path)
      await fsyncPath(parent)
      return { ok: true, value: undefined }
    } catch {
      return { ok: false, error: { code: 'actions.unavailable' } }
    }
  }

  function serialize(projectId: string, run: () => Promise<void>): Promise<void> {
    const prev = chains.get(projectId) ?? Promise.resolve()
    const next = prev.then(run, run)
    chains.set(
      projectId,
      Promise.allSettled([next]).then(() => undefined),
    )
    return next
  }

  return {
    read(projectId) {
      return readDocument(projectId)
    },

    async transact(projectId, change) {
      let outcome: ActionsTransactResult = {
        ok: false,
        error: { code: 'actions.unavailable' },
      }

      await serialize(projectId, async () => {
        const current = await readDocument(projectId)
        if (!current.ok) {
          outcome = current
          return
        }

        const planned = change(current.value)
        if (!planned.ok) {
          outcome = planned
          return
        }

        const written = await writeDocument(projectId, planned.value.file)
        if (!written.ok) {
          outcome = written
          return
        }
        outcome = planned
      })

      return outcome
    },
  }
}

/** Test helper: remove a leftover temp if present (adapter should not leave them). */
export async function unlinkQuiet(path: string): Promise<void> {
  await unlink(path).catch((error: unknown) => {
    if (!isEnoent(error)) throw error
  })
}

import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import {
  BoardFileParseError,
  type BoardFileV1,
  emptyBoardFileV1,
  parseBoardFileV1,
  serializeBoardFileV1,
} from '@porcelain/shared/board-file'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { ensureCompanionHidden } from '../../project/git-exclude'
import { watchProjectCompanion } from '../../review/review-watch'
import type { BoardStore, BoardStoreResult, BoardTransactResult } from './board-capabilities'

/** Soft size bound for board.json — large enough for real boards, small enough to fail closed. */
export const BOARD_FILE_MAX_BYTES = 512 * 1024

let tempNameCounter = 0

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isEnoent(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT'
}

function boardFilePath(projectPath: string): string {
  return projectPorcelainPath(projectPath, PROJECT_FILES.board)
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

async function ensureCompanionShell(projectPath: string): Promise<void> {
  await ensureCompanionHidden(projectPath)
  const dir = projectPorcelainDir(projectPath)
  await mkdir(dir, { recursive: true })
  const gi = projectPorcelainPath(projectPath, PROJECT_FILES.gitignore)
  try {
    await stat(gi)
  } catch (error) {
    if (!isEnoent(error)) throw error
    await writeFile(gi, DEFAULT_PROJECT_GITIGNORE)
  }
  watchProjectCompanion(projectPath)
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
 * JSON Board store: one strict v1 document per project path, serialized read-modify-write,
 * atomic temp+rename, corruption backup, size bound. Does not call home migration.
 */
export function createJsonBoardStore(options: { maxBytes?: number } = {}): BoardStore {
  const maxBytes = options.maxBytes ?? BOARD_FILE_MAX_BYTES
  const chains = new Map<string, Promise<void>>()

  async function readDocument(projectPath: string): Promise<BoardStoreResult<BoardFileV1>> {
    if (!isAbsolute(projectPath)) {
      return { ok: false, error: { code: 'board.unavailable' } }
    }
    const path = boardFilePath(projectPath)

    let fileStat: Awaited<ReturnType<typeof stat>>
    try {
      fileStat = await stat(path)
    } catch (error) {
      if (isEnoent(error)) return { ok: true, value: emptyBoardFileV1() }
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    if (fileStat.size > maxBytes) {
      console.error(
        `porcelain: ${path} is ${fileStat.size} bytes (> ${maxBytes}); board unavailable`,
      )
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error) {
      if (isEnoent(error)) return { ok: true, value: emptyBoardFileV1() }
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { ok: false, error: { code: 'board.unavailable' } }
      }
      return { ok: false, error: { code: 'board.unavailable' } }
    }

    try {
      return { ok: true, value: parseBoardFileV1(parsed) }
    } catch (error) {
      if (error instanceof BoardFileParseError && error.code === 'incompatible-version') {
        // Leave the file in place — do not coerce or delete real data.
        return { ok: false, error: { code: 'board.unavailable' } }
      }
      try {
        await moveToCorruptBackup(path)
      } catch {
        return { ok: false, error: { code: 'board.unavailable' } }
      }
      return { ok: false, error: { code: 'board.unavailable' } }
    }
  }

  async function writeDocument(
    projectPath: string,
    file: BoardFileV1,
  ): Promise<BoardStoreResult<void>> {
    if (!isAbsolute(projectPath)) {
      return { ok: false, error: { code: 'board.unavailable' } }
    }
    try {
      await ensureCompanionShell(projectPath)
      const path = boardFilePath(projectPath)
      const parent = dirname(path)
      await mkdir(parent, { recursive: true })
      tempNameCounter += 1
      const tmpPath = join(parent, `.tmp-board-${tempNameCounter}`)
      const body = serializeBoardFileV1(file)

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
      return { ok: false, error: { code: 'board.unavailable' } }
    }
  }

  function serialize(projectPath: string, run: () => Promise<void>): Promise<void> {
    const prev = chains.get(projectPath) ?? Promise.resolve()
    const next = prev.then(run, run)
    // The caller owns `next`'s rejection; this tail only keeps the chain alive so a
    // failed transaction never blocks the next one.
    chains.set(
      projectPath,
      Promise.allSettled([next]).then(() => undefined),
    )
    return next
  }

  return {
    read(projectPath) {
      return readDocument(projectPath)
    },

    async transact(projectPath, change) {
      let outcome: BoardTransactResult = {
        ok: false,
        error: { code: 'board.unavailable' },
      }

      await serialize(projectPath, async () => {
        const current = await readDocument(projectPath)
        if (!current.ok) {
          outcome = current
          return
        }

        const planned = change(current.value)
        if (!planned.ok) {
          outcome = planned
          return
        }

        const written = await writeDocument(projectPath, planned.value.file)
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

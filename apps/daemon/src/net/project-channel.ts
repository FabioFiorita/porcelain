import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import type { ZodType } from 'zod'
import { ensureCompanionHidden } from '../project/git-exclude'
import { watchProjectCompanion } from '../review/review-watch'

export interface ProjectChannel<T> {
  path(repoPath: string): string
  read(repoPath: string): Promise<T>
  write(repoPath: string, value: T): Promise<void>
  /**
   * Serialized read-modify-write per repo. The callback mutates in place or
   * returns a full replacement; either is persisted.
   */
  mutate(repoPath: string, fn: (current: T) => T | undefined): Promise<void>
}

/**
 * Durable JSON under `<repo>/.porcelain/<fileName>` — one document per project
 * (not keyed by absolute path). Creates the project dir + default `.gitignore`
 * on first write. Corrupt files are backed up and treated as empty.
 */
export function createProjectChannel<T>(opts: {
  fileName: string
  schema: ZodType<T>
  empty: () => T
  transform?: (parsed: T) => T
  maxBytes?: number
}): ProjectChannel<T> {
  const pathFor = (repoPath: string): string => projectPorcelainPath(repoPath, opts.fileName)

  // Per-repo mutation chains so two quick writes to the same project never drop.
  const chains = new Map<string, Promise<void>>()

  const parseFile = async (p: string): Promise<T> => {
    const raw = await readFile(p, 'utf8')
    try {
      const parsed = opts.schema.parse(JSON.parse(raw))
      return opts.transform ? opts.transform(parsed) : parsed
    } catch {
      await rename(p, `${p}.corrupt-${Date.now()}`).catch(() => {})
      return opts.empty()
    }
  }

  const readWithGuards = async (p: string): Promise<T> => {
    if (opts.maxBytes !== undefined) {
      let size: number
      try {
        size = (await stat(p)).size
      } catch {
        return opts.empty()
      }
      if (size > opts.maxBytes) {
        console.error(`porcelain: ${p} is ${size} bytes (> ${opts.maxBytes}); treating as empty`)
        return opts.empty()
      }
    }
    try {
      return await parseFile(p)
    } catch {
      return opts.empty()
    }
  }

  const ensureProjectDir = async (repoPath: string): Promise<void> => {
    const dir = projectPorcelainDir(repoPath)
    // Decide git visibility BEFORE the first file lands, so opening a repo and
    // letting an agent write never leaves `?? .porcelain/` in the human's status.
    await ensureCompanionHidden(repoPath)
    await mkdir(dir, { recursive: true })
    const gi = projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
    try {
      await stat(gi)
    } catch {
      await writeFile(gi, DEFAULT_PROJECT_GITIGNORE)
    }
    // Watcher skips missing dirs so it never invents an empty companion; attach once created.
    watchProjectCompanion(repoPath)
  }

  const read = async (repoPath: string): Promise<T> => readWithGuards(pathFor(repoPath))

  const write = async (repoPath: string, value: T): Promise<void> => {
    await ensureProjectDir(repoPath)
    const p = pathFor(repoPath)
    await mkdir(dirname(p), { recursive: true })
    const tmp = `${p}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 2))
    await rename(tmp, p)
  }

  const mutate = (repoPath: string, fn: (current: T) => T | undefined): Promise<void> => {
    const prev = chains.get(repoPath) ?? Promise.resolve()
    const run = prev.then(async () => {
      const current = await read(repoPath)
      const next = fn(current)
      await write(repoPath, next ?? current)
    })
    chains.set(
      repoPath,
      run.then(
        () => undefined,
        () => undefined,
      ),
    )
    return run
  }

  return { path: pathFor, read, write, mutate }
}

/** Markdown / plain-text project file (notes.md) — same ensure + atomic write. */
export async function readProjectText(repoPath: string, fileName: string): Promise<string> {
  try {
    return await readFile(projectPorcelainPath(repoPath, fileName), 'utf8')
  } catch {
    return ''
  }
}

export async function writeProjectText(
  repoPath: string,
  fileName: string,
  text: string,
): Promise<void> {
  const dir = projectPorcelainDir(repoPath)
  await ensureCompanionHidden(repoPath)
  await mkdir(dir, { recursive: true })
  const gi = projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
  try {
    await stat(gi)
  } catch {
    await writeFile(gi, DEFAULT_PROJECT_GITIGNORE)
  }
  watchProjectCompanion(repoPath)
  const p = projectPorcelainPath(repoPath, fileName)
  if (text === '') {
    // Drop empty notes so the tree stays tidy.
    await unlink(p).catch(() => {})
    return
  }
  const tmp = `${p}.tmp`
  await writeFile(tmp, text)
  await rename(tmp, p)
}

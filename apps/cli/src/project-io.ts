import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_COMPANION_FORMAT_VERSION,
  PROJECT_COMPANION_LAYOUT,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'

/**
 * Sync helpers for the dependency-free CLI writing into `<repo>/.porcelain/`.
 * Mirrors daemon project-channel atomic tmp+rename + default gitignore.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Refuse to write into a companion root some other Porcelain laid out
 * differently. Read-only on purpose: the daemon's Project Data adapter is the
 * only writer of `project-manifest.json`, so a MISSING manifest is a normal
 * first write (the next daemon write fills it in) and an unreadable one is left
 * exactly as it is. Only a root that declares an incompatible layout stops us —
 * a clear diagnostic beats silently converting someone's data.
 */
export function assertCompanionRootVersion(repoPath: string): void {
  const path = projectPorcelainPath(repoPath, PROJECT_FILES.manifest)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return
  }
  const value = isRecord(parsed) && isRecord(parsed.value) ? parsed.value : undefined
  const compatible =
    isRecord(parsed) &&
    parsed.version === PROJECT_COMPANION_FORMAT_VERSION &&
    value?.layout === PROJECT_COMPANION_LAYOUT
  if (compatible) return
  throw new Error(
    `${path} declares an unsupported companion layout — upgrade Porcelain (this CLI writes version ${PROJECT_COMPANION_FORMAT_VERSION} ${PROJECT_COMPANION_LAYOUT})`,
  )
}

export function ensureProjectDir(repoPath: string): void {
  assertCompanionRootVersion(repoPath)
  const dir = projectPorcelainDir(repoPath)
  mkdirSync(dir, { recursive: true })
  const gi = projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
  try {
    statSync(gi)
  } catch {
    writeFileSync(gi, DEFAULT_PROJECT_GITIGNORE)
  }
}

export function readProjectJson(repoPath: string, fileName: string): unknown {
  try {
    return JSON.parse(readFileSync(projectPorcelainPath(repoPath, fileName), 'utf8'))
  } catch {
    return undefined
  }
}

export function writeProjectJson(repoPath: string, fileName: string, value: unknown): void {
  ensureProjectDir(repoPath)
  const path = projectPorcelainPath(repoPath, fileName)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, path)
}

export function readProjectText(repoPath: string, fileName: string): string {
  try {
    return readFileSync(projectPorcelainPath(repoPath, fileName), 'utf8')
  } catch {
    return ''
  }
}

export function projectFile(repoPath: string, ...parts: string[]): string {
  return join(projectPorcelainDir(repoPath), ...parts)
}

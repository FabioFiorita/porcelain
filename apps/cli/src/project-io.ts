import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'

/**
 * Sync helpers for the dependency-free CLI writing into `<repo>/.porcelain/`.
 * Mirrors daemon project-channel atomic tmp+rename + default gitignore.
 */

export function ensureProjectDir(repoPath: string): void {
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

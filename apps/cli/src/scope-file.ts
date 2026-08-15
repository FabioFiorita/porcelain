import { join, relative } from 'node:path'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson, writeProjectJson } from './project-io'

// Monorepo hide/pin in <repo>/.porcelain/scope.json — paths stored repo-relative.

export interface RepoScope {
  hiddenPaths: string[]
  pinnedPaths: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function emptyRepo(): RepoScope {
  return { hiddenPaths: [], pinnedPaths: [] }
}

function parseRepo(value: unknown): RepoScope {
  if (!isRecord(value)) return emptyRepo()
  const hidden = Array.isArray(value.hiddenPaths)
    ? value.hiddenPaths.filter((p): p is string => typeof p === 'string' && p !== '')
    : []
  const pinned = Array.isArray(value.pinnedPaths)
    ? value.pinnedPaths.filter((p): p is string => typeof p === 'string' && p !== '')
    : []
  return { hiddenPaths: hidden, pinnedPaths: pinned }
}

function toRelative(repoPath: string, path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') throw new Error('path must be non-empty')
  if (trimmed === repoPath || trimmed === '.') return ''
  if (trimmed.startsWith(`${repoPath}/`)) return trimmed.slice(repoPath.length + 1)
  if (trimmed.startsWith('/')) {
    const rel = relative(repoPath, trimmed)
    if (rel.startsWith('..') || rel === '') throw new Error(`path must be inside the repo: ${path}`)
    return rel
  }
  return trimmed.replace(/^\.\//, '')
}

/** Any accepted path form → the repo-relative form scope.json (and project.json) store. */
export function relativeScopePath(repoPath: string, path: string): string {
  return toRelative(repoPath, path)
}

/** Relative → absolute under repo for display / app parity. */
export function resolveScopePath(repoPath: string, path: string): string {
  const rel = toRelative(repoPath, path)
  return rel === '' ? repoPath : join(repoPath, rel)
}

function readDisk(repoPath: string): RepoScope {
  return parseRepo(readProjectJson(repoPath, PROJECT_FILES.scope))
}

function writeDisk(repoPath: string, scope: RepoScope): void {
  writeProjectJson(repoPath, PROJECT_FILES.scope, scope)
}

/** Scope exactly as stored: repo-relative, which is also project.json's shape. */
export function readRelativeScope(repoPath: string): RepoScope {
  return readDisk(repoPath)
}

/** Scope with absolute paths (for describe / compatibility). */
export function readScope(repoPath: string): RepoScope {
  const scope = readDisk(repoPath)
  return {
    hiddenPaths: scope.hiddenPaths.map((p) => join(repoPath, p)),
    pinnedPaths: scope.pinnedPaths.map((p) => join(repoPath, p)),
  }
}

export function hidePath(repoPath: string, path: string): void {
  const rel = toRelative(repoPath, path)
  if (rel === '') return
  const scope = readDisk(repoPath)
  if (scope.hiddenPaths.includes(rel)) return
  writeDisk(repoPath, { ...scope, hiddenPaths: [...scope.hiddenPaths, rel] })
}

export function unhidePath(repoPath: string, path: string): void {
  const rel = toRelative(repoPath, path)
  const scope = readDisk(repoPath)
  writeDisk(repoPath, {
    ...scope,
    hiddenPaths: scope.hiddenPaths.filter((p) => p !== rel),
  })
}

export function pinPath(repoPath: string, path: string): void {
  const rel = toRelative(repoPath, path)
  if (rel === '') return
  const scope = readDisk(repoPath)
  if (scope.pinnedPaths.includes(rel)) return
  writeDisk(repoPath, { ...scope, pinnedPaths: [...scope.pinnedPaths, rel] })
}

export function unpinPath(repoPath: string, path: string): void {
  const rel = toRelative(repoPath, path)
  const scope = readDisk(repoPath)
  writeDisk(repoPath, {
    ...scope,
    pinnedPaths: scope.pinnedPaths.filter((p) => p !== rel),
  })
}

export function clearScope(repoPath: string): void {
  writeDisk(repoPath, emptyRepo())
}

export function describeScope(repoPath: string, scope: RepoScope): string {
  const rel = (p: string): string =>
    p.startsWith(`${repoPath}/`) ? p.slice(repoPath.length + 1) : p
  const hidden =
    scope.hiddenPaths.length === 0
      ? '  (none)'
      : scope.hiddenPaths.map((p) => `  - ${rel(p)}`).join('\n')
  const pinned =
    scope.pinnedPaths.length === 0
      ? '  (none)'
      : scope.pinnedPaths.map((p) => `  - ${rel(p)}`).join('\n')
  return `Monorepo scope for ${repoPath} (.porcelain/scope.json):\nHidden:\n${hidden}\nPinned:\n${pinned}\n\nUse \`porcelain scope hide|unhide|pin|unpin --path <rel>\`. \`scope clear\` drops both lists. Track or ignore via .porcelain/.gitignore.`
}

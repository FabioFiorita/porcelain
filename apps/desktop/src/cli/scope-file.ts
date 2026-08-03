import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'

// Builtins only — see cli.ts. Monorepo hide/pin scope: folders the human (or agent)
// hides from the tree / pins for Quick Access. TWO-WAY channel in ~/.porcelain/scope.json
// (app: scope-store.ts). Paths stored absolute under the repo; CLI accepts relative.

export interface RepoScope {
  hiddenPaths: string[]
  pinnedPaths: string[]
}

type ScopeMap = Record<string, RepoScope>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function scopePath(): string {
  return process.env.PORCELAIN_SCOPE ?? porcelainHomePath('scope.json')
}

function emptyRepo(): RepoScope {
  return { hiddenPaths: [], pinnedPaths: [] }
}

function parseRepo(value: unknown): RepoScope | null {
  if (!isRecord(value)) return null
  const hidden = Array.isArray(value.hiddenPaths)
    ? value.hiddenPaths.filter((p): p is string => typeof p === 'string' && p !== '')
    : []
  const pinned = Array.isArray(value.pinnedPaths)
    ? value.pinnedPaths.filter((p): p is string => typeof p === 'string' && p !== '')
    : []
  return { hiddenPaths: hidden, pinnedPaths: pinned }
}

function readAll(): ScopeMap {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(scopePath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: ScopeMap = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    const repo = parseRepo(value)
    if (repo) all[repoPath] = repo
  }
  return all
}

function writeAll(all: ScopeMap): void {
  const path = scopePath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

/** Relative → absolute under repo; absolute kept as-is. */
export function resolveScopePath(repoPath: string, path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') throw new Error('path must be non-empty')
  if (trimmed.startsWith(`${repoPath}/`) || trimmed === repoPath) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  return join(repoPath, trimmed)
}

export function readScope(repoPath: string): RepoScope {
  return readAll()[repoPath] ?? emptyRepo()
}

export function hidePath(repoPath: string, path: string): void {
  const absolute = resolveScopePath(repoPath, path)
  const all = readAll()
  const repo = all[repoPath] ?? emptyRepo()
  if (repo.hiddenPaths.includes(absolute)) {
    all[repoPath] = repo
    writeAll(all)
    return
  }
  all[repoPath] = { ...repo, hiddenPaths: [...repo.hiddenPaths, absolute] }
  writeAll(all)
}

export function unhidePath(repoPath: string, path: string): void {
  const absolute = resolveScopePath(repoPath, path)
  const all = readAll()
  const repo = all[repoPath]
  if (!repo) return
  all[repoPath] = {
    ...repo,
    hiddenPaths: repo.hiddenPaths.filter((p) => p !== absolute),
  }
  writeAll(all)
}

export function pinPath(repoPath: string, path: string): void {
  const absolute = resolveScopePath(repoPath, path)
  const all = readAll()
  const repo = all[repoPath] ?? emptyRepo()
  if (repo.pinnedPaths.includes(absolute)) {
    all[repoPath] = repo
    writeAll(all)
    return
  }
  all[repoPath] = { ...repo, pinnedPaths: [...repo.pinnedPaths, absolute] }
  writeAll(all)
}

export function unpinPath(repoPath: string, path: string): void {
  const absolute = resolveScopePath(repoPath, path)
  const all = readAll()
  const repo = all[repoPath]
  if (!repo) return
  all[repoPath] = {
    ...repo,
    pinnedPaths: repo.pinnedPaths.filter((p) => p !== absolute),
  }
  writeAll(all)
}

/** Drop every hidden and pinned path for the repo. */
export function clearScope(repoPath: string): void {
  const all = readAll()
  if (!(repoPath in all)) return
  delete all[repoPath]
  writeAll(all)
}

/** Human-readable listing for `porcelain scope list`. */
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
  return `Monorepo scope for ${repoPath}:\nHidden:\n${hidden}\nPinned:\n${pinned}\n\nUse \`porcelain scope hide|unhide|pin|unpin --path <rel>\` (repo-relative preferred). \`scope clear\` drops both lists.`
}

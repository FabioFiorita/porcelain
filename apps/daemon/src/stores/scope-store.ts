import { join, relative } from 'node:path'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'

/**
 * Monorepo hide/pin scope — `<repo>/.porcelain/scope.json`.
 * Paths are stored **repo-relative** on disk; API surfaces absolute paths under
 * the repo for tree matching. TWO-WAY: app + CLI. Git-shareable when tracked.
 */

const repoScopeSchema = z.object({
  hiddenPaths: z.array(z.string()).default([]),
  pinnedPaths: z.array(z.string()).default([]),
})
export type RepoScope = z.infer<typeof repoScopeSchema>

const emptyRepo = (): RepoScope => ({ hiddenPaths: [], pinnedPaths: [] })

const channel = createProjectChannel({
  fileName: PROJECT_FILES.scope,
  schema: repoScopeSchema,
  empty: emptyRepo,
})

export function scopePath(repoPath: string): string {
  return channel.path(repoPath)
}

/** Normalize user/agent input to a repo-relative path for storage. */
export function toRelativeScopePath(repoPath: string, path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') throw new Error('path must be non-empty')
  if (trimmed === repoPath || trimmed === '.') return ''
  if (trimmed.startsWith(`${repoPath}/`)) return trimmed.slice(repoPath.length + 1)
  if (trimmed.startsWith('/')) {
    const rel = relative(repoPath, trimmed)
    if (rel.startsWith('..') || rel === '') {
      throw new Error(`path must be inside the repo: ${path}`)
    }
    return rel
  }
  // already relative
  return trimmed.replace(/^\.\//, '')
}

/** Absolute path under repo for a stored relative path. */
export function toAbsoluteScopePath(repoPath: string, rel: string): string {
  if (rel === '' || rel === '.') return repoPath
  return join(repoPath, rel)
}

function expandScope(repoPath: string, scope: RepoScope): RepoScope {
  return {
    hiddenPaths: scope.hiddenPaths.map((p) => toAbsoluteScopePath(repoPath, p)),
    pinnedPaths: scope.pinnedPaths.map((p) => toAbsoluteScopePath(repoPath, p)),
  }
}

export async function readRepoScope(repoPath: string): Promise<RepoScope> {
  await ensureProjectCompanion(repoPath)
  return expandScope(repoPath, await channel.read(repoPath))
}

export async function hiddenPathsForRepo(repoPath: string): Promise<Set<string>> {
  return new Set((await readRepoScope(repoPath)).hiddenPaths)
}

export async function pinnedPathsForRepo(repoPath: string): Promise<string[]> {
  return (await readRepoScope(repoPath)).pinnedPaths
}

/** @deprecated use toRelativeScopePath; kept for call sites that resolve then hide. */
export function resolveScopePath(repoPath: string, path: string): string {
  const rel = toRelativeScopePath(repoPath, path)
  return toAbsoluteScopePath(repoPath, rel)
}

export async function hidePath(repoPath: string, path: string): Promise<void> {
  const rel = toRelativeScopePath(repoPath, path)
  if (rel === '') return
  await ensureProjectCompanion(repoPath)
  await channel.mutate(repoPath, (scope) => {
    if (scope.hiddenPaths.includes(rel)) return scope
    return { ...scope, hiddenPaths: [...scope.hiddenPaths, rel] }
  })
}

export async function unhidePath(repoPath: string, path: string): Promise<void> {
  const rel = toRelativeScopePath(repoPath, path)
  await ensureProjectCompanion(repoPath)
  await channel.mutate(repoPath, (scope) => ({
    ...scope,
    hiddenPaths: scope.hiddenPaths.filter((p) => p !== rel),
  }))
}

export async function pinPath(repoPath: string, path: string): Promise<void> {
  const rel = toRelativeScopePath(repoPath, path)
  if (rel === '') return
  await ensureProjectCompanion(repoPath)
  await channel.mutate(repoPath, (scope) => {
    if (scope.pinnedPaths.includes(rel)) return scope
    return { ...scope, pinnedPaths: [...scope.pinnedPaths, rel] }
  })
}

export async function unpinPath(repoPath: string, path: string): Promise<void> {
  const rel = toRelativeScopePath(repoPath, path)
  await ensureProjectCompanion(repoPath)
  await channel.mutate(repoPath, (scope) => ({
    ...scope,
    pinnedPaths: scope.pinnedPaths.filter((p) => p !== rel),
  }))
}

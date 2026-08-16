import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { projectOverridesSchema } from '@porcelain/contracts/projects'
import { projectOverlayOverridesPath } from '@shared/project-porcelain'
import { projectOverridesPath } from '@shared/project-store'
import { z } from 'zod'

/**
 * Personal hide/pin scope lives in the daemon-root private Project store.
 * Paths are stored **repo-relative** on disk; API surfaces absolute paths under
 * the repo for tree matching. The tracked project overlay is a second, read-only
 * source of project defaults. Reads merge both sources; writes stay personal so
 * merely changing navigation never edits a checkout's tracked bytes. This module
 * deliberately never reads or writes the retired `.scope.json`.
 */

const repoScopeSchema = z.object({
  hiddenPaths: z.array(z.string()).default([]),
  pinnedPaths: z.array(z.string()).default([]),
})
export type RepoScope = z.infer<typeof repoScopeSchema>

const emptyRepo = (): RepoScope => ({ hiddenPaths: [], pinnedPaths: [] })

export type ScopeStore = Readonly<{
  readRepoScope: (repoPath: string) => Promise<RepoScope>
  hiddenPathsForRepo: (repoPath: string) => Promise<Set<string>>
  pinnedPathsForRepo: (repoPath: string) => Promise<string[]>
  hidePath: (repoPath: string, path: string) => Promise<void>
  unhidePath: (repoPath: string, path: string) => Promise<void>
  pinPath: (repoPath: string, path: string) => Promise<void>
  unpinPath: (repoPath: string, path: string) => Promise<void>
}>

export type ScopeStoreOptions = Readonly<{
  homeDir: string
  projectIdForRepo: (repoPath: string) => Promise<string | null>
}>

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

export function createScopeStore(options: ScopeStoreOptions): ScopeStore {
  async function readPrivate(repoPath: string): Promise<RepoScope> {
    const id = await options.projectIdForRepo(repoPath)
    if (id === null) return emptyRepo()
    try {
      const parsed = projectOverridesSchema.safeParse(
        JSON.parse(await readFile(projectOverridesPath(options.homeDir, id), 'utf8')),
      )
      return parsed.success ? parsed.data : emptyRepo()
    } catch {
      return emptyRepo()
    }
  }

  async function readTracked(repoPath: string): Promise<RepoScope> {
    try {
      const parsed = projectOverridesSchema.safeParse(
        JSON.parse(await readFile(projectOverlayOverridesPath(repoPath), 'utf8')),
      )
      return parsed.success ? parsed.data : emptyRepo()
    } catch {
      return emptyRepo()
    }
  }

  async function readRepoScope(repoPath: string): Promise<RepoScope> {
    const [privateScope, tracked] = await Promise.all([
      readPrivate(repoPath),
      readTracked(repoPath),
    ])
    return expandScope(repoPath, {
      hiddenPaths: [...new Set([...privateScope.hiddenPaths, ...tracked.hiddenPaths])],
      pinnedPaths: [...new Set([...privateScope.pinnedPaths, ...tracked.pinnedPaths])],
    })
  }

  async function mutate(repoPath: string, update: (scope: RepoScope) => RepoScope): Promise<void> {
    const id = await options.projectIdForRepo(repoPath)
    if (id === null) return
    const current = await readPrivate(repoPath)
    const next = update(current)
    await mkdir(join(options.homeDir, 'projects', id), { recursive: true })
    await writeFile(
      projectOverridesPath(options.homeDir, id),
      `${JSON.stringify({ ...next, worktrees: {} }, null, 2)}\n`,
    )
  }

  return Object.freeze({
    readRepoScope,
    hiddenPathsForRepo: async (repoPath) => new Set((await readRepoScope(repoPath)).hiddenPaths),
    pinnedPathsForRepo: async (repoPath) => (await readRepoScope(repoPath)).pinnedPaths,
    hidePath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') {
        await mutate(repoPath, (scope) =>
          scope.hiddenPaths.includes(rel)
            ? scope
            : { ...scope, hiddenPaths: [...scope.hiddenPaths, rel] },
        )
      }
    },
    unhidePath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      await mutate(repoPath, (scope) => ({
        ...scope,
        hiddenPaths: scope.hiddenPaths.filter((entry) => entry !== rel),
      }))
    },
    pinPath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      if (rel !== '') {
        await mutate(repoPath, (scope) =>
          scope.pinnedPaths.includes(rel)
            ? scope
            : { ...scope, pinnedPaths: [...scope.pinnedPaths, rel] },
        )
      }
    },
    unpinPath: async (repoPath, path) => {
      const rel = toRelativeScopePath(repoPath, path)
      await mutate(repoPath, (scope) => ({
        ...scope,
        pinnedPaths: scope.pinnedPaths.filter((entry) => entry !== rel),
      }))
    },
  })
}

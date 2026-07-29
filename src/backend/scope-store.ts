import { join } from 'node:path'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The monorepo scope channel: per-repo **hidden** and **pinned** paths that keep a
 * huge tree navigable (hide irrelevant apps, pin the ones you care about). Keyed by
 * absolute repo path in `~/.porcelain/scope.json` — same fixed-home rationale as
 * layers/notes so the dependency-free CLI can read+write them. TWO-WAY: the app
 * (tree Hide/Pin) and the porcelain CLI (`scope hide|unhide|pin|unpin|list`) both
 * author; atomic tmp+rename writes; the watcher emits `scope` so the tree refreshes.
 *
 * Paths are stored absolute. The CLI accepts repo-relative paths and joins them to
 * the repo root before writing.
 */
const repoScopeSchema = z.object({
  hiddenPaths: z.array(z.string()).default([]),
  pinnedPaths: z.array(z.string()).default([]),
})
export type RepoScope = z.infer<typeof repoScopeSchema>

export const scopeSchema = z.record(z.string(), repoScopeSchema)
export type ScopeMap = z.infer<typeof scopeSchema>

const emptyRepo = (): RepoScope => ({ hiddenPaths: [], pinnedPaths: [] })

const channel = createHomeChannel({
  envVar: 'PORCELAIN_SCOPE',
  fileName: 'scope.json',
  schema: scopeSchema,
  empty: (): ScopeMap => ({}),
})

// Must match src/cli/scope-file.ts. PORCELAIN_SCOPE redirects both sides for tests.
export const scopePath = channel.path

export async function readRepoScope(repoPath: string): Promise<RepoScope> {
  return (await channel.readAll())[repoPath] ?? emptyRepo()
}

export async function hiddenPathsForRepo(repoPath: string): Promise<Set<string>> {
  return new Set((await readRepoScope(repoPath)).hiddenPaths)
}

export async function pinnedPathsForRepo(repoPath: string): Promise<string[]> {
  return (await readRepoScope(repoPath)).pinnedPaths
}

/** Normalize a user/agent path to absolute under repo (relative → join). */
export function resolveScopePath(repoPath: string, path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') throw new Error('path must be non-empty')
  if (trimmed.startsWith(`${repoPath}/`) || trimmed === repoPath) return trimmed
  // Absolute path outside the repo — store as given; relative paths join under the repo.
  if (trimmed.startsWith('/')) return trimmed
  return join(repoPath, trimmed)
}

export async function hidePath(repoPath: string, path: string): Promise<void> {
  const absolute = resolveScopePath(repoPath, path)
  await channel.mutate((all) => {
    const repo = all[repoPath] ?? emptyRepo()
    if (repo.hiddenPaths.includes(absolute)) return
    all[repoPath] = { ...repo, hiddenPaths: [...repo.hiddenPaths, absolute] }
  })
}

export async function unhidePath(repoPath: string, path: string): Promise<void> {
  const absolute = resolveScopePath(repoPath, path)
  await channel.mutate((all) => {
    const repo = all[repoPath]
    if (!repo) return
    all[repoPath] = {
      ...repo,
      hiddenPaths: repo.hiddenPaths.filter((p) => p !== absolute),
    }
  })
}

export async function pinPath(repoPath: string, path: string): Promise<void> {
  const absolute = resolveScopePath(repoPath, path)
  await channel.mutate((all) => {
    const repo = all[repoPath] ?? emptyRepo()
    if (repo.pinnedPaths.includes(absolute)) return
    all[repoPath] = { ...repo, pinnedPaths: [...repo.pinnedPaths, absolute] }
  })
}

export async function unpinPath(repoPath: string, path: string): Promise<void> {
  const absolute = resolveScopePath(repoPath, path)
  await channel.mutate((all) => {
    const repo = all[repoPath]
    if (!repo) return
    all[repoPath] = {
      ...repo,
      pinnedPaths: repo.pinnedPaths.filter((p) => p !== absolute),
    }
  })
}

/** Cross-environment grouping: a normalized origin, or an Environment-local repository key. */
export function projectGroupingKey(input: {
  originUrl: string | null
  localIdentity: string
}): string {
  const origin = normalizeOriginUrl(input.originUrl)
  if (origin !== null) return origin
  return `local:${input.localIdentity}`
}

/**
 * Strip credentials, trailing slashes, and a trailing `.git` so equivalent remotes
 * group without becoming the same Environment-local Project record.
 */
export function normalizeOriginUrl(originUrl: string | null): string | null {
  if (originUrl === null) return null
  const trimmed = originUrl.trim()
  if (trimmed === '') return null

  const scp = /^([A-Za-z0-9._-]+)@([^:]+):(.+)$/.exec(trimmed)
  const user = scp?.[1]
  const host = scp?.[2]
  const repoPath = scp?.[3]
  if (user !== undefined && host !== undefined && repoPath !== undefined) {
    return `ssh://${user}@${host}/${stripGitSuffix(repoPath)}`
  }

  try {
    const parsed = new URL(trimmed)
    parsed.username = ''
    parsed.password = ''
    parsed.hash = ''
    parsed.search = ''
    const path = stripGitSuffix(parsed.pathname.replace(/\/+$/, ''))
    parsed.pathname = path.startsWith('/') ? path : `/${path}`
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return stripGitSuffix(trimmed.replace(/\/+$/, ''))
  }
}

export type StoredHubWorktree = Readonly<{
  id: string
  gitDir: string
}>

export type StoredHubProject = Readonly<{
  id: string
  commonGitDir: string
  groupingKey: string
  name: string
  worktrees: readonly StoredHubWorktree[]
}>

export type DiscoveredWorktree = Readonly<{
  path: string
  gitDir: string
  branch: string
  isPrimary: boolean
}>

export type DiscoveredProject = Readonly<{
  commonGitDir: string
  groupingKey: string
  name: string
  worktrees: readonly DiscoveredWorktree[]
}>

export function rematchWorktrees(
  stored: readonly StoredHubWorktree[],
  discovered: readonly DiscoveredWorktree[],
  createId: () => string,
): StoredHubWorktree[] {
  const remaining = new Map(stored.map((worktree) => [worktree.gitDir, worktree]))
  return discovered.map((worktree) => {
    const existing = remaining.get(worktree.gitDir)
    if (existing !== undefined) {
      remaining.delete(worktree.gitDir)
      return existing
    }
    return { id: createId(), gitDir: worktree.gitDir }
  })
}

/**
 * Bind a discovered checkout family to a stored Project.
 * Prefer the common Git dir; if that dir is gone, reuse an orphaned record
 * with the same grouping key so a moved repository keeps its identity.
 */
export function rematchProject(
  stored: readonly StoredHubProject[],
  discovered: DiscoveredProject,
  commonGitDirExists: (commonGitDir: string) => boolean,
  createId: () => string,
): StoredHubProject {
  const byGitDir = stored.find((project) => project.commonGitDir === discovered.commonGitDir)
  if (byGitDir !== undefined) {
    return {
      ...byGitDir,
      groupingKey: discovered.groupingKey,
      name: discovered.name,
      worktrees: rematchWorktrees(byGitDir.worktrees, discovered.worktrees, createId),
    }
  }

  // Only a portable origin proves that a repository which moved is the same Project. Historical
  // `name:*` records and current `local:*` records are deliberately not rematched across paths:
  // a basename collision must never inherit another repository's Actions or private profile.
  const portable = !/^(?:name|local):/.test(discovered.groupingKey)
  const orphan = portable
    ? stored.find(
        (project) =>
          project.groupingKey === discovered.groupingKey &&
          !commonGitDirExists(project.commonGitDir),
      )
    : undefined
  if (orphan !== undefined) {
    return {
      ...orphan,
      commonGitDir: discovered.commonGitDir,
      name: discovered.name,
      worktrees: rematchWorktrees(orphan.worktrees, discovered.worktrees, createId),
    }
  }

  return {
    id: createId(),
    commonGitDir: discovered.commonGitDir,
    groupingKey: discovered.groupingKey,
    name: discovered.name,
    worktrees: rematchWorktrees([], discovered.worktrees, createId),
  }
}

export function worktreeDisplayName(path: string): string {
  const segments = path.split(/[/\\]/).filter((segment) => segment !== '')
  return segments.at(-1) ?? path
}

function stripGitSuffix(value: string): string {
  return value.replace(/\.git$/i, '')
}

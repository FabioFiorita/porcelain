import { z } from 'zod'
import type { Layer } from './flow'

export const appConfigSchema = z.object({
  recentRepos: z.array(z.string()).default([]),
  repos: z
    .record(
      z.string(),
      z.object({
        hiddenPaths: z.array(z.string()).default([]),
        pinnedPaths: z.array(z.string()).default([]),
        layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
        notes: z.string().default(''),
      }),
    )
    .default({}),
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = { recentRepos: [], repos: {} }

const emptyRepo = (): AppConfig['repos'][string] => ({
  hiddenPaths: [],
  pinnedPaths: [],
  notes: '',
})

const MAX_RECENTS = 10

export function withRecentRepo(config: AppConfig, repoPath: string): AppConfig {
  return {
    ...config,
    recentRepos: [repoPath, ...config.recentRepos.filter((p) => p !== repoPath)].slice(
      0,
      MAX_RECENTS,
    ),
  }
}

export function withHiddenPath(config: AppConfig, repoPath: string, path: string): AppConfig {
  const repo = config.repos[repoPath] ?? emptyRepo()
  if (repo.hiddenPaths.includes(path)) return config
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, hiddenPaths: [...repo.hiddenPaths, path] },
    },
  }
}

export function withoutHiddenPath(config: AppConfig, repoPath: string, path: string): AppConfig {
  const repo = config.repos[repoPath]
  if (!repo) return config
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, hiddenPaths: repo.hiddenPaths.filter((p) => p !== path) },
    },
  }
}

export function hiddenPathsFor(config: AppConfig, repoPath: string): Set<string> {
  return new Set(config.repos[repoPath]?.hiddenPaths ?? [])
}

/**
 * Repo-relative file paths with hidden entries removed. Hidden paths may be
 * absolute (under repoPath) or already repo-relative; a hidden directory hides
 * its whole subtree but never a sibling that merely shares a name prefix.
 */
export function visibleFilePaths(
  repoPath: string,
  files: readonly string[],
  hidden: ReadonlySet<string>,
): string[] {
  if (hidden.size === 0) return [...files]
  return files.filter((file) => {
    for (const h of hidden) {
      const rel = h.startsWith(`${repoPath}/`) ? h.slice(repoPath.length + 1) : h
      if (file === rel || file.startsWith(`${rel}/`)) return false
    }
    return true
  })
}

export function layersFor(config: AppConfig, repoPath: string): Layer[] | undefined {
  return config.repos[repoPath]?.layers
}

/** Set the per-repo flow layers; `null` clears the override back to defaults. */
export function withRepoLayers(
  config: AppConfig,
  repoPath: string,
  layers: Layer[] | null,
): AppConfig {
  const repo = config.repos[repoPath] ?? emptyRepo()
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, layers: layers ?? undefined },
    },
  }
}

export function withPinnedPath(config: AppConfig, repoPath: string, path: string): AppConfig {
  const repo = config.repos[repoPath] ?? emptyRepo()
  if (repo.pinnedPaths.includes(path)) return config
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, pinnedPaths: [...repo.pinnedPaths, path] },
    },
  }
}

export function withoutPinnedPath(config: AppConfig, repoPath: string, path: string): AppConfig {
  const repo = config.repos[repoPath]
  if (!repo) return config
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, pinnedPaths: repo.pinnedPaths.filter((p) => p !== path) },
    },
  }
}

export function pinnedPathsFor(config: AppConfig, repoPath: string): string[] {
  return config.repos[repoPath]?.pinnedPaths ?? []
}

export function notesFor(config: AppConfig, repoPath: string): string {
  return config.repos[repoPath]?.notes ?? ''
}

export function withRepoNotes(config: AppConfig, repoPath: string, notes: string): AppConfig {
  const repo = config.repos[repoPath] ?? emptyRepo()
  if (repo.notes === notes) return config
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, notes },
    },
  }
}

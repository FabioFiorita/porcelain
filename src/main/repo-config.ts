import { z } from 'zod'
import type { Layer } from './flow'

export const appConfigSchema = z.object({
  recentRepos: z.array(z.string()).default([]),
  repos: z
    .record(
      z.string(),
      z.object({
        hiddenPaths: z.array(z.string()).default([]),
        layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
      }),
    )
    .default({}),
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = { recentRepos: [], repos: {} }

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
  const repo = config.repos[repoPath] ?? { hiddenPaths: [] }
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

export function layersFor(config: AppConfig, repoPath: string): Layer[] | undefined {
  return config.repos[repoPath]?.layers
}

/** Set the per-repo flow layers; `null` clears the override back to defaults. */
export function withRepoLayers(
  config: AppConfig,
  repoPath: string,
  layers: Layer[] | null,
): AppConfig {
  const repo = config.repos[repoPath] ?? { hiddenPaths: [] }
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: { ...repo, layers: layers ?? undefined },
    },
  }
}

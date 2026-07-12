import { z } from 'zod'
import {
  type AgentProvider,
  agentProviderSchema,
  type ThreadOptions,
  threadOptionsSchema,
} from '../shared/agent-protocol'

// How often the Agent tab's Limits group re-polls provider quotas. A choice, not a
// free number, so the mapping to poll intervals stays in one place (see useAgentLimits).
export const limitsRefreshSchema = z.enum(['1m', '5m', '15m', 'manual'])
export type LimitsRefresh = z.infer<typeof limitsRefreshSchema>

export const appConfigSchema = z.object({
  recentRepos: z.array(z.string()).default([]),
  // Global (not per-repo): when true the daemon additionally listens on the
  // detected Tailscale interface (see backend/tailnet.ts + server.ts), gated on
  // the same token. Absent/false ⇒ loopback only. Toggled from Settings.
  tailnetBind: z.boolean().optional(),
  // Global (not per-repo): when true the daemon additionally listens on the
  // machine's RFC1918 private addresses (see backend/lan.ts + server.ts) so
  // devices on the home LAN can reach it, gated on the same token. Cleartext on
  // the LAN — opt-in, default off (see the audit skill). Toggled from Settings.
  lanBind: z.boolean().optional(),
  // Global (not per-repo): the Agent tab's favorited models, each a
  // `provider:modelId` key. Daemon-side so the favorites follow the user to the
  // iPad/browser client. Optional so pre-existing configs stay valid.
  agentModelFavorites: z.array(z.string()).optional(),
  // Global (not per-repo): how often the Agent tab's Limits group re-polls provider
  // quotas. Some providers surface limits by spawning the codexbar CLI — a real
  // subprocess with a web fetch per poll — so the cadence is user-tunable to bound that
  // cost. Absent ⇒ the shared DEFAULT_LIMITS_REFRESH ('5m'). Set from Settings → Agents.
  limitsRefresh: limitsRefreshSchema.optional(),
  // Global (not per-repo): the last provider/model/options a thread was created or
  // switched to, so a NEW thread defaults to what the user last worked with instead
  // of a hardcoded provider + empty model. The three fields travel together — a model
  // belongs to its provider, so we never mix a provider from one selection with a
  // model from another. Optional so pre-existing configs stay valid.
  lastAgentSelection: z
    .object({
      provider: agentProviderSchema,
      model: z.string(),
      options: threadOptionsSchema.optional(),
    })
    .optional(),
  repos: z
    .record(
      z.string(),
      z.object({
        hiddenPaths: z.array(z.string()).default([]),
        pinnedPaths: z.array(z.string()).default([]),
        // Deprecated: reviewed marks + layers + notes moved to their ~/.porcelain agent
        // channels (reviewed-store.ts / layers-store.ts / notes-store.ts) so the MCP can
        // read them. Kept optional only so the one-time startup migrations
        // (migrateReviewedFromConfig / migrateLayersFromConfig / migrateNotesFromConfig)
        // can copy legacy values out — no code writes them anymore.
        reviewedPaths: z.array(z.string()).optional(),
        layers: z.array(z.object({ label: z.string(), pattern: z.string() })).optional(),
        notes: z.string().optional(),
      }),
    )
    .default({}),
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = { recentRepos: [], repos: {} }

const emptyRepo = (): AppConfig['repos'][string] => ({
  hiddenPaths: [],
  pinnedPaths: [],
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

/** Toggle a `provider:modelId` favorite on/off (global — not repo-keyed). */
export function toggleModelFavorite(config: AppConfig, key: string): AppConfig {
  const current = config.agentModelFavorites ?? []
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
  return { ...config, agentModelFavorites: next }
}

// The remembered provider/model/options a new thread defaults to. Non-optional shape
// (the config field itself is optional until the first selection is recorded).
export type AgentSelection = NonNullable<AppConfig['lastAgentSelection']>

/** Remember the provider/model/options last used, so the next new thread defaults to it. */
export function withLastAgentSelection(config: AppConfig, selection: AgentSelection): AppConfig {
  return { ...config, lastAgentSelection: selection }
}

/**
 * Resolve the provider/model/options a new thread is created with. When the caller
 * supplies BOTH provider and model, honor them verbatim (the options ride along). When
 * either is missing, fall back to the last-used selection as a unit — provider, model,
 * and options together, never a cross-provider mix. With no selection recorded yet, use
 * the legacy default (provider 'claude' + empty model, i.e. the driver's own default).
 */
export function resolveCreationDefaults(
  config: AppConfig,
  input: { provider?: AgentProvider; model?: string; options?: ThreadOptions },
): { provider: AgentProvider; model: string; options?: ThreadOptions } {
  if (input.provider !== undefined && input.model !== undefined) {
    return { provider: input.provider, model: input.model, options: input.options }
  }
  const last = config.lastAgentSelection
  if (last) return { provider: last.provider, model: last.model, options: last.options }
  return { provider: input.provider ?? 'claude', model: input.model ?? '' }
}

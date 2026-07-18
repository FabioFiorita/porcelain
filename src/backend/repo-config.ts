import { z } from 'zod'
import {
  type AgentInteraction,
  type AgentMode,
  type AgentProvider,
  agentInteractionSchema,
  agentModeSchema,
  agentProviderSchema,
  type ProviderStatus,
  providerStatusSchema,
  type ThreadOptions,
  threadOptionsSchema,
} from '../shared/agent-protocol'

// The config a thread was last created/switched to for one provider — model, access mode,
// Build/Plan interaction, and effort/context options. Persisted per provider (see
// `agentProviderDefaults`) so a new thread resumes exactly how THAT provider was last left,
// never crossing a model or effort from a different provider. Only `model` is required
// (a provider always has one, even '' = the CLI's own default); the rest are absent until set.
export const agentProviderDefaultSchema = z.object({
  model: z.string(),
  mode: agentModeSchema.optional(),
  interaction: agentInteractionSchema.optional(),
  options: threadOptionsSchema.optional(),
})
export type AgentProviderDefault = z.infer<typeof agentProviderDefaultSchema>

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
  // Global (not per-repo): the provider a thread was last created/switched to, so a bare
  // "+" new thread reopens in the provider the user last worked in. Optional until the
  // first selection is recorded.
  lastAgentProvider: agentProviderSchema.optional(),
  // Global (not per-repo): the last-used config PER provider (see agentProviderDefaultSchema),
  // so a new thread — bare "+" or explicit-provider pick — resumes how that provider was
  // last left, independent of the others. A partial record: a provider absent from the map
  // simply has no remembered defaults yet. Optional so pre-existing configs stay valid.
  agentProviderDefaults: z
    .partialRecord(agentProviderSchema, agentProviderDefaultSchema)
    .optional(),
  // Legacy (superseded by lastAgentProvider + agentProviderDefaults): the single last-used
  // provider/model/options. No code writes it anymore — kept in the schema so pre-existing
  // configs still parse, and read back once by resolveCreationDefaults as a fallback seed.
  lastAgentSelection: z
    .object({
      provider: agentProviderSchema,
      model: z.string(),
      options: threadOptionsSchema.optional(),
    })
    .optional(),
  // Global (not per-repo): the last successful `agentProviders` probe, persisted so the
  // Agent tab's model picker renders its favorites immediately on first open (stale-while-
  // revalidate) instead of waiting on the slow CLI probe. Overwritten on each successful
  // re-probe. Optional so pre-existing configs stay valid.
  agentProviderCache: z.array(providerStatusSchema).optional(),
  repos: z
    .record(
      z.string(),
      z.object({
        hiddenPaths: z.array(z.string()).default([]),
        pinnedPaths: z.array(z.string()).default([]),
        // Deprecated: reviewed marks + layers + notes moved to their ~/.porcelain agent
        // channels (reviewed-store.ts / layers-store.ts / notes-store.ts) so the porcelain
        // CLI can read them. Kept optional only so the one-time startup migrations
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

export function withoutRecentRepo(config: AppConfig, repoPath: string): AppConfig {
  return { ...config, recentRepos: config.recentRepos.filter((p) => p !== repoPath) }
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

/**
 * Remember the config a thread was last created/switched to for its provider — `model`
 * plus whichever of mode/interaction/options the caller knows — and mark that provider as
 * the last-used one. The patch is MERGED into the provider's existing entry (a field the
 * caller omits keeps its remembered value), and never crosses into another provider.
 */
export function withAgentDefaults(
  config: AppConfig,
  provider: AgentProvider,
  patch: Partial<AgentProviderDefault> & { model: string },
): AppConfig {
  const existing = config.agentProviderDefaults?.[provider]
  return {
    ...config,
    lastAgentProvider: provider,
    agentProviderDefaults: {
      ...config.agentProviderDefaults,
      [provider]: { ...existing, ...patch },
    },
  }
}

/** Persist the latest successful `agentProviders` probe for stale-while-revalidate reads. */
export function withAgentProviderCache(config: AppConfig, cache: ProviderStatus[]): AppConfig {
  return { ...config, agentProviderCache: cache }
}

/**
 * Resolve the full config a new thread is created with, drawn from the chosen provider's
 * remembered defaults so an explicit-provider create still inherits how that provider was
 * last left (a non-empty caller value always wins). The provider is the caller's, else the
 * last-used one, else the legacy selection's provider, else 'claude'; then per that provider:
 *   - model: the caller's non-empty model, else the provider default's model, else '' (the CLI's own default)
 *   - mode: the caller's, else the provider default's, else 'full'
 *   - options: the caller's, else the provider default's
 *   - interaction: the provider default's (absent = build)
 * With no per-provider defaults yet, the legacy single `lastAgentSelection` seeds the last
 * provider and — for its own provider — that provider's model/options: a one-way READ
 * fallback so pre-existing configs keep working with no startup migration.
 */
export function resolveCreationDefaults(
  config: AppConfig,
  input: { provider?: AgentProvider; model?: string; mode?: AgentMode; options?: ThreadOptions },
): {
  provider: AgentProvider
  model: string
  mode: AgentMode
  options?: ThreadOptions
  interaction?: AgentInteraction
} {
  const legacy = config.lastAgentSelection
  const provider = input.provider ?? config.lastAgentProvider ?? legacy?.provider ?? 'claude'
  const defaults =
    config.agentProviderDefaults?.[provider] ??
    (legacy?.provider === provider
      ? {
          model: legacy.model,
          ...(legacy.options !== undefined ? { options: legacy.options } : {}),
        }
      : undefined)
  const model =
    input.model !== undefined && input.model !== '' ? input.model : (defaults?.model ?? '')
  const mode = input.mode ?? defaults?.mode ?? 'full'
  const options = input.options ?? defaults?.options
  const interaction = defaults?.interaction
  return {
    provider,
    model,
    mode,
    ...(options !== undefined ? { options } : {}),
    ...(interaction !== undefined ? { interaction } : {}),
  }
}

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
  // Legacy GLOBAL last-provider / per-provider defaults (pre per-repo). No code writes
  // these anymore — kept so old configs still parse, and resolveCreationDefaults falls
  // back to them when a repo has no remembered defaults yet.
  lastAgentProvider: agentProviderSchema.optional(),
  agentProviderDefaults: z
    .partialRecord(agentProviderSchema, agentProviderDefaultSchema)
    .optional(),
  // Legacy (superseded by lastAgentProvider + agentProviderDefaults, then by per-repo):
  // the single last-used provider/model/options. Read-only fallback seed.
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
        // Per-repo: the provider a thread was last created/switched to in THIS repo, so a
        // bare "+" reopens that provider only for this project (soaphealth ≠ porcelain).
        lastAgentProvider: agentProviderSchema.optional(),
        // Per-repo: last-used model/mode/interaction/options PER provider for this repo.
        agentProviderDefaults: z
          .partialRecord(agentProviderSchema, agentProviderDefaultSchema)
          .optional(),
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
 * Remember the config a thread was last created/switched to for its provider **in this
 * repo** — `model` plus whichever of mode/interaction/options the caller knows — and mark
 * that provider as the last-used one for the repo. The patch is MERGED into the provider's
 * existing per-repo entry (a field the caller omits keeps its remembered value), and never
 * crosses into another provider or another repo.
 */
export function withAgentDefaults(
  config: AppConfig,
  repoPath: string,
  provider: AgentProvider,
  patch: Partial<AgentProviderDefault> & { model: string },
): AppConfig {
  const repo = config.repos[repoPath] ?? emptyRepo()
  const existing = repo.agentProviderDefaults?.[provider]
  return {
    ...config,
    repos: {
      ...config.repos,
      [repoPath]: {
        ...repo,
        lastAgentProvider: provider,
        agentProviderDefaults: {
          ...repo.agentProviderDefaults,
          [provider]: { ...existing, ...patch },
        },
      },
    },
  }
}

/** Persist the latest successful `agentProviders` probe for stale-while-revalidate reads. */
export function withAgentProviderCache(config: AppConfig, cache: ProviderStatus[]): AppConfig {
  return { ...config, agentProviderCache: cache }
}

/**
 * Resolve the full config a new thread is created with, drawn from the chosen provider's
 * remembered defaults **for this repo** so an explicit-provider create still inherits how
 * that provider was last left here (a non-empty caller value always wins). Lookups prefer
 * per-repo state, then the legacy global `lastAgentProvider`/`agentProviderDefaults`, then
 * the single `lastAgentSelection` seed — so pre-existing configs keep working with no
 * startup migration. The provider is the caller's, else the repo's last-used one, else
 * the global/legacy last-used, else 'claude'; then per that provider:
 *   - model: the caller's non-empty model, else the provider default's model, else '' (the CLI's own default)
 *   - mode: the caller's, else the provider default's, else 'full'
 *   - options: the caller's, else the provider default's
 *   - interaction: the provider default's (absent = build)
 */
export function resolveCreationDefaults(
  config: AppConfig,
  repoPath: string,
  input: { provider?: AgentProvider; model?: string; mode?: AgentMode; options?: ThreadOptions },
): {
  provider: AgentProvider
  model: string
  mode: AgentMode
  options?: ThreadOptions
  interaction?: AgentInteraction
} {
  const repo = config.repos[repoPath]
  const legacy = config.lastAgentSelection
  const provider =
    input.provider ??
    repo?.lastAgentProvider ??
    config.lastAgentProvider ??
    legacy?.provider ??
    'claude'
  const defaults =
    repo?.agentProviderDefaults?.[provider] ??
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

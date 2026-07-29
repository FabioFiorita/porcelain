import { z } from 'zod'

// Plain `z.object` (never `.strict()`): this schema parses a config file written by older
// builds, and home-channel treats a parse failure as corruption — it renames the file aside
// and starts from empty. Stripping unknown keys is what lets a dropped field disappear
// without taking the user's recents the first time they open a build that dropped a key.
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
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = { recentRepos: [] }

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

/**
 * Repo-relative file paths with hidden entries removed. Hidden paths may be
 * absolute (under repoPath) or already repo-relative; a hidden directory hides
 * its whole subtree but never a sibling that merely shares a name prefix.
 * Used with the scope channel (`scope-store`), not config.json.
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

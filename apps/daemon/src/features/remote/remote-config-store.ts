import { join } from 'node:path'
import { z } from 'zod'
import { createHomeChannel } from '../../net/home-channel'

export const appConfigSchema = z
  .object({
    // Global (not per-repo): when true the daemon additionally listens on the
    // detected Tailscale interface (see remote-tailnet.ts + server.ts), gated on
    // the same authentication gate. Absent/false ⇒ loopback only. Toggled from Settings.
    tailnetBind: z.boolean().optional(),
    // Global (not per-repo): when true the daemon additionally listens on the
    // machine's RFC1918 private addresses (see remote-lan.ts + server.ts) so
    // devices on the home LAN can reach it, gated on the same authentication. Cleartext on
    // the LAN — opt-in, default off (see the audit skill). Toggled from Settings.
    lanBind: z.boolean().optional(),
    // Public HTTPS reverse proxy managed through `tailscale funnel`.
    funnelBind: z.boolean().optional(),
  })
  .strict()

export type AppConfig = z.infer<typeof appConfigSchema>

export const emptyConfig: AppConfig = {}

// The backend is Electron-free, so it can't resolve `app.getPath('userData')`
// itself; the shell injects the directory once at startup (src/main/index.ts).
// The store's `path` is lazy, so any read before init is a programming error —
// fail loudly instead of writing config.json somewhere surprising.
let configDir: string | null = null

/** Called once from the Electron shell with `app.getPath('userData')`, before any config read. */
export function initConfigDir(dir: string): void {
  configDir = dir
}

// Config lives under userData, not ~/.porcelain, and the app is its SOLE writer —
// hence the `path` form and the in-memory cache (safe: nothing else touches it).
const channel = createHomeChannel<AppConfig>({
  path: () => {
    if (configDir === null) throw new Error('config-store: initConfigDir has not been called')
    return join(configDir, 'config.json')
  },
  schema: appConfigSchema,
  empty: () => emptyConfig,
  cache: 'memory',
})

export const loadConfig: () => Promise<AppConfig> = channel.readAll

export async function updateConfig(fn: (current: AppConfig) => AppConfig): Promise<AppConfig> {
  let updated = emptyConfig
  await channel.mutate((current) => {
    updated = fn(current)
    return updated
  })
  return updated
}

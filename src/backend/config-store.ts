import { join } from 'node:path'
import { createHomeChannel } from './home-channel'
import { type AppConfig, appConfigSchema, emptyConfig } from './repo-config'

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

export const loadConfig = channel.readAll

export async function updateConfig(fn: (current: AppConfig) => AppConfig): Promise<AppConfig> {
  let updated = emptyConfig
  await channel.mutate((current) => {
    updated = fn(current)
    return updated
  })
  return updated
}

import { join } from 'node:path'
import { createJsonStore } from './json-store'
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

const store = createJsonStore<AppConfig>({
  path: () => {
    if (configDir === null) throw new Error('config-store: initConfigDir has not been called')
    return join(configDir, 'config.json')
  },
  parse: (raw) => appConfigSchema.parse(raw),
  empty: emptyConfig,
})

export const loadConfig = store.load
export const updateConfig = store.update

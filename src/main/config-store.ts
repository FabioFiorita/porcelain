import { app } from 'electron'
import { join } from 'path'
import { createJsonStore } from './json-store'
import { type AppConfig, appConfigSchema, emptyConfig } from './repo-config'

const store = createJsonStore<AppConfig>({
  path: () => join(app.getPath('userData'), 'config.json'),
  parse: (raw) => appConfigSchema.parse(raw),
  empty: emptyConfig,
})

export const loadConfig = store.load
export const updateConfig = store.update

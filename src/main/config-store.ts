import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { type AppConfig, appConfigSchema, emptyConfig } from './repo-config'

const configPath = (): string => join(app.getPath('userData'), 'config.json')

let cached: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached
  try {
    const raw = await readFile(configPath(), 'utf8')
    cached = appConfigSchema.parse(JSON.parse(raw))
  } catch {
    cached = emptyConfig
  }
  return cached
}

export async function saveConfig(config: AppConfig): Promise<void> {
  cached = config
  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf8')
}

// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import {
  appConfigSchema,
  emptyConfig,
  initConfigDir,
  loadConfig,
  updateConfig,
} from './remote-config-store'

describe('appConfigSchema', () => {
  it('rejects keys outside the current config contract', () => {
    const result = appConfigSchema.safeParse({
      recentRepos: ['/repo'],
      retiredSetting: true,
    })
    expect(result.success).toBe(false)
  })

  it('accepts the Remote-only empty config', () => {
    expect(appConfigSchema.parse(emptyConfig)).toEqual({})
    expect(appConfigSchema.parse({ tailnetBind: true, lanBind: false, funnelBind: true })).toEqual({
      tailnetBind: true,
      lanBind: false,
      funnelBind: true,
    })
  })
})

describe('remote config store', () => {
  it('throws when read before initConfigDir', async () => {
    await expect(loadConfig()).rejects.toThrow('config-store: initConfigDir has not been called')
  })

  it('persists the unversioned flag record at join(dir, config.json)', async () => {
    await withTemporaryDirectory('porcelain-remote-config-', async (dir) => {
      initConfigDir(dir)
      expect(await loadConfig()).toEqual({})

      const updated = await updateConfig((current) => ({ ...current, lanBind: true }))
      expect(updated).toEqual({ lanBind: true })
      expect(await loadConfig()).toEqual({ lanBind: true })

      const path = join(dir, 'config.json')
      expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ lanBind: true })
    })
  })
})

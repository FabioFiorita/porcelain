import { describe, expect, it } from 'vitest'
import { appConfigSchema, emptyConfig } from './repo-config'

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

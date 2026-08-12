import { describe, expect, it } from 'vitest'
import { appConfigSchema, emptyConfig, visibleFilePaths } from './repo-config'

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

describe('visibleFilePaths', () => {
  it('returns all files when nothing is hidden', () => {
    expect(visibleFilePaths('/repo', ['src/a.ts', 'src/b.ts'], new Set())).toEqual([
      'src/a.ts',
      'src/b.ts',
    ])
  })

  it('hides the subtree of an absolute hidden directory', () => {
    expect(
      visibleFilePaths(
        '/repo',
        ['apps/legacy/a.ts', 'apps/legacy-other/b.ts', 'apps/web/c.ts'],
        new Set(['/repo/apps/legacy']),
      ),
    ).toEqual(['apps/legacy-other/b.ts', 'apps/web/c.ts'])
  })

  it('hides a single relative path', () => {
    expect(visibleFilePaths('/repo', ['src/a.ts', 'src/b.ts'], new Set(['src/a.ts']))).toEqual([
      'src/b.ts',
    ])
  })
})

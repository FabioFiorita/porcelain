import { describe, expect, it } from 'vitest'
import {
  appConfigSchema,
  emptyConfig,
  visibleFilePaths,
  withoutRecentRepo,
  withRecentRepo,
} from './repo-config'

describe('withRecentRepo', () => {
  it('prepends a new repo', () => {
    const config = withRecentRepo(withRecentRepo(emptyConfig, '/a'), '/b')
    expect(config.recentRepos).toEqual(['/b', '/a'])
  })

  it('moves an existing repo to the front without duplicating', () => {
    const config = withRecentRepo(withRecentRepo(withRecentRepo(emptyConfig, '/a'), '/b'), '/a')
    expect(config.recentRepos).toEqual(['/a', '/b'])
  })

  it('caps the list at 10 entries', () => {
    let config = emptyConfig
    for (let i = 0; i < 12; i++) config = withRecentRepo(config, `/repo-${i}`)
    expect(config.recentRepos).toHaveLength(10)
    expect(config.recentRepos[0]).toBe('/repo-11')
  })
})

describe('withoutRecentRepo', () => {
  it('removes the given repo from the recents', () => {
    const config = withoutRecentRepo(withRecentRepo(withRecentRepo(emptyConfig, '/a'), '/b'), '/a')
    expect(config.recentRepos).toEqual(['/b'])
  })

  it('is a no-op when the repo is not in the recents', () => {
    const config = withRecentRepo(emptyConfig, '/a')
    expect(withoutRecentRepo(config, '/missing').recentRepos).toEqual(['/a'])
  })
})

describe('appConfigSchema', () => {
  it('rejects keys outside the current config contract', () => {
    const result = appConfigSchema.safeParse({
      recentRepos: ['/repo'],
      retiredSetting: true,
    })
    expect(result.success).toBe(false)
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

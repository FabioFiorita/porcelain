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
  it('parses a config written by an older build, stripping retired keys', () => {
    // Back-compat guard, not a formality: home-channel renames a config it cannot parse to
    // `.corrupt-*` and starts empty, so a `.strict()` here would silently wipe the user's
    // recents the first time they opened a build that dropped a key.
    const parsed = appConfigSchema.parse({
      recentRepos: ['/repo'],
      agentModelFavorites: ['claude:opus'],
      lastAgentProvider: 'codex',
      agentProviderDefaults: { codex: { model: 'gpt-5' } },
      lastAgentSelection: { provider: 'codex', model: 'gpt-5' },
      agentProviderCache: [{ provider: 'claude', installed: true }],
      repos: {
        '/repo': {
          hiddenPaths: ['/repo/apps/legacy'],
          pinnedPaths: ['/repo/apps/dtc'],
          notes: 'old',
          reviewedPaths: ['src/a.ts'],
          layers: [{ label: 'X', pattern: 'x' }],
        },
      },
    })
    expect(parsed.recentRepos).toEqual(['/repo'])
    // Retired keys are stripped rather than carried forward, so the next write drops them.
    for (const key of [
      'agentModelFavorites',
      'lastAgentProvider',
      'agentProviderDefaults',
      'lastAgentSelection',
      'agentProviderCache',
      'repos',
    ]) {
      expect(Object.keys(parsed)).not.toContain(key)
    }
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

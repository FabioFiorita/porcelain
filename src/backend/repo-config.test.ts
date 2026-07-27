import { describe, expect, it } from 'vitest'
import {
  appConfigSchema,
  emptyConfig,
  hiddenPathsFor,
  pinnedPathsFor,
  visibleFilePaths,
  withHiddenPath,
  withoutHiddenPath,
  withoutPinnedPath,
  withoutRecentRepo,
  withPinnedPath,
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

  it('keeps the per-repo config so hidden/pinned paths survive a re-open', () => {
    let config = withRecentRepo(emptyConfig, '/repo')
    config = withHiddenPath(config, '/repo', '/repo/x')
    config = withoutRecentRepo(config, '/repo')
    expect(config.recentRepos).toEqual([])
    expect(hiddenPathsFor(config, '/repo')).toEqual(new Set(['/repo/x']))
  })
})

describe('hidden paths', () => {
  it('hides and unhides a path per repo', () => {
    let config = withHiddenPath(emptyConfig, '/repo', '/repo/apps/legacy')
    expect(hiddenPathsFor(config, '/repo')).toEqual(new Set(['/repo/apps/legacy']))
    expect(hiddenPathsFor(config, '/other')).toEqual(new Set())

    config = withoutHiddenPath(config, '/repo', '/repo/apps/legacy')
    expect(hiddenPathsFor(config, '/repo')).toEqual(new Set())
  })

  it('does not duplicate hidden paths', () => {
    let config = withHiddenPath(emptyConfig, '/repo', '/repo/x')
    config = withHiddenPath(config, '/repo', '/repo/x')
    expect(config.repos['/repo']?.hiddenPaths).toEqual(['/repo/x'])
  })
})

describe('pinned paths', () => {
  it('pins and unpins a path per repo without duplicates', () => {
    let config = withPinnedPath(emptyConfig, '/repo', '/repo/apps/dtc')
    config = withPinnedPath(config, '/repo', '/repo/apps/dtc')
    expect(pinnedPathsFor(config, '/repo')).toEqual(['/repo/apps/dtc'])
    expect(pinnedPathsFor(config, '/other')).toEqual([])

    config = withoutPinnedPath(config, '/repo', '/repo/apps/dtc')
    expect(pinnedPathsFor(config, '/repo')).toEqual([])
  })

  it('keeps hidden paths and pins independent', () => {
    let config = withPinnedPath(emptyConfig, '/repo', '/repo/pin')
    config = withHiddenPath(config, '/repo', '/repo/hide')
    expect(pinnedPathsFor(config, '/repo')).toEqual(['/repo/pin'])
    expect(hiddenPathsFor(config, '/repo')).toEqual(new Set(['/repo/hide']))
  })
})

describe('appConfigSchema', () => {
  it('parses a config written by an older build, stripping the retired agent-runner keys', () => {
    // Back-compat guard, not a formality: home-channel renames a config it cannot parse to
    // `.corrupt-*` and starts empty, so a `.strict()` here would silently wipe the user's
    // recents and hidden/pinned paths the first time they opened a build that dropped a key.
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
          lastAgentProvider: 'claude',
          agentProviderDefaults: { claude: { model: 'opus' } },
        },
      },
    })
    expect(parsed.recentRepos).toEqual(['/repo'])
    expect(parsed.repos['/repo']?.hiddenPaths).toEqual(['/repo/apps/legacy'])
    expect(parsed.repos['/repo']?.pinnedPaths).toEqual(['/repo/apps/dtc'])
    // Retired keys are stripped rather than carried forward, so the next write drops them.
    for (const key of [
      'agentModelFavorites',
      'lastAgentProvider',
      'agentProviderDefaults',
      'lastAgentSelection',
      'agentProviderCache',
    ]) {
      expect(Object.keys(parsed)).not.toContain(key)
    }
    expect(Object.keys(parsed.repos['/repo'] ?? {})).toEqual(['hiddenPaths', 'pinnedPaths'])
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
        ['src/foo/a.ts', 'src/foo', 'src/bar.ts'],
        new Set(['/repo/src/foo']),
      ),
    ).toEqual(['src/bar.ts'])
  })

  it('hides the subtree of a repo-relative hidden directory', () => {
    expect(visibleFilePaths('/repo', ['src/foo/a.ts', 'src/bar.ts'], new Set(['src/foo']))).toEqual(
      ['src/bar.ts'],
    )
  })

  it('keeps siblings that merely share a name prefix', () => {
    expect(visibleFilePaths('/repo', ['src/foobar.ts'], new Set(['src/foo']))).toEqual([
      'src/foobar.ts',
    ])
  })

  it('hides an exact file without touching near-matches', () => {
    expect(
      visibleFilePaths('/repo', ['src/a.ts', 'src/ab.ts'], new Set(['/repo/src/a.ts'])),
    ).toEqual(['src/ab.ts'])
  })
})

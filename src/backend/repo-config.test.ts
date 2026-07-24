import { describe, expect, it } from 'vitest'
import {
  type AppConfig,
  appConfigSchema,
  emptyConfig,
  hiddenPathsFor,
  pinnedPathsFor,
  resolveCreationDefaults,
  visibleFilePaths,
  withAgentDefaults,
  withAgentProviderCache,
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

describe('withAgentDefaults', () => {
  it('accepts a config without any defaults (old configs stay valid)', () => {
    const parsed = appConfigSchema.parse({ recentRepos: [], repos: {} })
    expect(parsed.lastAgentProvider).toBeUndefined()
    expect(parsed.agentProviderDefaults).toBeUndefined()
    expect(parsed.repos['/x']?.lastAgentProvider).toBeUndefined()
  })

  it('still parses a legacy lastAgentSelection (kept for the read fallback)', () => {
    const parsed = appConfigSchema.parse({
      recentRepos: [],
      repos: {},
      lastAgentSelection: { provider: 'codex', model: 'gpt-5', options: { effort: 'high' } },
    })
    expect(parsed.lastAgentSelection).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      options: { effort: 'high' },
    })
  })

  it("records a provider's defaults on the repo and marks it the last-used provider", () => {
    const config = withAgentDefaults(emptyConfig, '/repo-a', 'codex', {
      model: 'gpt-5',
      mode: 'auto-edits',
      interaction: 'plan',
      options: { effort: 'high' },
    })
    expect(config.repos['/repo-a']?.lastAgentProvider).toBe('codex')
    expect(config.repos['/repo-a']?.agentProviderDefaults?.codex).toEqual({
      model: 'gpt-5',
      mode: 'auto-edits',
      interaction: 'plan',
      options: { effort: 'high' },
    })
    // Global slots stay untouched (legacy read-only).
    expect(config.lastAgentProvider).toBeUndefined()
    expect(config.agentProviderDefaults).toBeUndefined()
  })

  it('keeps each provider independent (no cross-provider mix)', () => {
    let config = withAgentDefaults(emptyConfig, '/repo', 'codex', { model: 'gpt-5' })
    config = withAgentDefaults(config, '/repo', 'claude', { model: 'opus', mode: 'full' })
    expect(config.repos['/repo']?.lastAgentProvider).toBe('claude')
    expect(config.repos['/repo']?.agentProviderDefaults?.codex).toEqual({ model: 'gpt-5' })
    expect(config.repos['/repo']?.agentProviderDefaults?.claude).toEqual({
      model: 'opus',
      mode: 'full',
    })
  })

  it('scopes defaults per repo (soaphealth ≠ porcelain)', () => {
    let config = withAgentDefaults(emptyConfig, '/soaphealth', 'claude', {
      model: 'opus',
      options: { effort: 'xhigh' },
    })
    config = withAgentDefaults(config, '/porcelain', 'claude', {
      model: 'sonnet',
      options: { effort: 'low' },
    })
    expect(config.repos['/soaphealth']?.agentProviderDefaults?.claude).toEqual({
      model: 'opus',
      options: { effort: 'xhigh' },
    })
    expect(config.repos['/porcelain']?.agentProviderDefaults?.claude).toEqual({
      model: 'sonnet',
      options: { effort: 'low' },
    })
  })

  it('merges a patch into the existing entry, keeping omitted fields', () => {
    let config = withAgentDefaults(emptyConfig, '/repo', 'claude', {
      model: 'opus',
      interaction: 'plan',
      options: { effort: 'high' },
    })
    // A later mode-only change keeps the remembered interaction + options.
    config = withAgentDefaults(config, '/repo', 'claude', { model: 'opus', mode: 'approve' })
    expect(config.repos['/repo']?.agentProviderDefaults?.claude).toEqual({
      model: 'opus',
      mode: 'approve',
      interaction: 'plan',
      options: { effort: 'high' },
    })
  })
})

describe('withAgentProviderCache', () => {
  it('round-trips the persisted provider probe through the schema', () => {
    const cache = [
      { provider: 'claude' as const, installed: true, authenticated: true, models: [] },
    ]
    const config = withAgentProviderCache(emptyConfig, cache)
    expect(appConfigSchema.parse(config).agentProviderCache).toEqual(cache)
  })
})

describe('resolveCreationDefaults', () => {
  it('inherits a provider’s remembered defaults on an explicit-provider create', () => {
    const config = withAgentDefaults(emptyConfig, '/repo', 'codex', {
      model: 'gpt-5',
      mode: 'auto-edits',
      interaction: 'plan',
      options: { effort: 'high' },
    })
    expect(resolveCreationDefaults(config, '/repo', { provider: 'codex' })).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      mode: 'auto-edits',
      interaction: 'plan',
      options: { effort: 'high' },
    })
  })

  it('lets a non-empty caller value win over the remembered default', () => {
    const config = withAgentDefaults(emptyConfig, '/repo', 'codex', {
      model: 'gpt-5',
      mode: 'auto-edits',
    })
    expect(
      resolveCreationDefaults(config, '/repo', {
        provider: 'codex',
        model: 'gpt-5-mini',
        mode: 'full',
      }),
    ).toEqual({ provider: 'codex', model: 'gpt-5-mini', mode: 'full' })
  })

  it('resumes the last-used provider (and its defaults) on a bare create for that repo', () => {
    let config = withAgentDefaults(emptyConfig, '/repo', 'claude', { model: 'opus' })
    config = withAgentDefaults(config, '/repo', 'codex', {
      model: 'gpt-5',
      options: { effort: 'high' },
    })
    expect(resolveCreationDefaults(config, '/repo', {})).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      mode: 'full',
      options: { effort: 'high' },
    })
  })

  it('does not leak another repo’s last provider into this one', () => {
    let config = withAgentDefaults(emptyConfig, '/soaphealth', 'codex', {
      model: 'gpt-5',
      options: { effort: 'high' },
    })
    config = withAgentDefaults(config, '/porcelain', 'claude', { model: 'opus' })
    expect(resolveCreationDefaults(config, '/soaphealth', {})).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      mode: 'full',
      options: { effort: 'high' },
    })
    expect(resolveCreationDefaults(config, '/porcelain', {})).toEqual({
      provider: 'claude',
      model: 'opus',
      mode: 'full',
    })
  })

  it('uses the legacy default (claude + empty model + full) with nothing recorded', () => {
    expect(resolveCreationDefaults(emptyConfig, '/repo', {})).toEqual({
      provider: 'claude',
      model: '',
      mode: 'full',
    })
  })

  it('keeps an explicit provider fallback when no defaults are recorded', () => {
    const config: AppConfig = { recentRepos: [], repos: {} }
    expect(resolveCreationDefaults(config, '/repo', { provider: 'opencode' })).toEqual({
      provider: 'opencode',
      model: '',
      mode: 'full',
    })
  })

  it('falls back to legacy global agentProviderDefaults when the repo has none', () => {
    const config: AppConfig = {
      recentRepos: [],
      repos: {},
      lastAgentProvider: 'codex',
      agentProviderDefaults: {
        codex: { model: 'gpt-5', options: { effort: 'high' } },
      },
    }
    expect(resolveCreationDefaults(config, '/new-repo', {})).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      mode: 'full',
      options: { effort: 'high' },
    })
  })

  it('falls back to a legacy lastAgentSelection as the last provider + its seed', () => {
    const config: AppConfig = {
      recentRepos: [],
      repos: {},
      lastAgentSelection: { provider: 'codex', model: 'gpt-5', options: { effort: 'high' } },
    }
    // Bare create: legacy provider becomes the last-used one, its model/options seed defaults.
    expect(resolveCreationDefaults(config, '/repo', {})).toEqual({
      provider: 'codex',
      model: 'gpt-5',
      mode: 'full',
      options: { effort: 'high' },
    })
    // Explicit different provider: no legacy seed for it → provider default model.
    expect(resolveCreationDefaults(config, '/repo', { provider: 'claude' })).toEqual({
      provider: 'claude',
      model: '',
      mode: 'full',
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

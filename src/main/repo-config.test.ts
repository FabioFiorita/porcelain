import { describe, expect, it } from 'vitest'
import {
  emptyConfig,
  hiddenPathsFor,
  layersFor,
  withHiddenPath,
  withoutHiddenPath,
  withRecentRepo,
  withRepoLayers,
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

describe('repo layers', () => {
  const layers = [{ label: 'Stories', pattern: '\\.stories\\.[a-z]+$' }]

  it('sets and clears the per-repo override', () => {
    let config = withRepoLayers(emptyConfig, '/repo', layers)
    expect(layersFor(config, '/repo')).toEqual(layers)
    expect(layersFor(config, '/other')).toBeUndefined()

    config = withRepoLayers(config, '/repo', null)
    expect(layersFor(config, '/repo')).toBeUndefined()
  })

  it('survives hiding and unhiding paths', () => {
    let config = withRepoLayers(emptyConfig, '/repo', layers)
    config = withHiddenPath(config, '/repo', '/repo/x')
    config = withoutHiddenPath(config, '/repo', '/repo/x')
    expect(layersFor(config, '/repo')).toEqual(layers)
  })

  it('preserves hidden paths when layers change', () => {
    let config = withHiddenPath(emptyConfig, '/repo', '/repo/x')
    config = withRepoLayers(config, '/repo', layers)
    expect(hiddenPathsFor(config, '/repo')).toEqual(new Set(['/repo/x']))
  })
})

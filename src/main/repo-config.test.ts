import { describe, expect, it } from 'vitest'
import {
  emptyConfig,
  hiddenPathsFor,
  layersFor,
  notesFor,
  pinnedPathsFor,
  visibleFilePaths,
  withHiddenPath,
  withoutHiddenPath,
  withoutPinnedPath,
  withPinnedPath,
  withRecentRepo,
  withRepoLayers,
  withRepoNotes,
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

describe('repo notes', () => {
  it('defaults to an empty string per repo', () => {
    expect(notesFor(emptyConfig, '/repo')).toBe('')
  })

  it('sets and reads notes independently per repo', () => {
    const config = withRepoNotes(emptyConfig, '/repo', '# todo\n- ship it')
    expect(notesFor(config, '/repo')).toBe('# todo\n- ship it')
    expect(notesFor(config, '/other')).toBe('')
  })

  it('returns the same config object when notes are unchanged', () => {
    const config = withRepoNotes(emptyConfig, '/repo', 'hi')
    expect(withRepoNotes(config, '/repo', 'hi')).toBe(config)
  })

  it('keeps notes and pins independent', () => {
    let config = withPinnedPath(emptyConfig, '/repo', '/repo/pin')
    config = withRepoNotes(config, '/repo', 'note')
    expect(pinnedPathsFor(config, '/repo')).toEqual(['/repo/pin'])
    expect(notesFor(config, '/repo')).toBe('note')
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

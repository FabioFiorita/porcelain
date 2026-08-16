import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_IGNORED,
  COMPANION_CHANNELS,
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_COMPANION_FORMAT_VERSION,
  PROJECT_COMPANION_LAYOUT,
  PROJECT_FILES,
  PROJECT_PORCELAIN_DIR,
  parseDispositions,
  projectPorcelainDir,
  projectPorcelainPath,
  renderGitignore,
} from './project-porcelain'

// The two literals `project-manifest.json` carries. The daemon writes them and the
// CLI refuses to write into a root that declares anything else, so they are pinned
// here rather than spelled twice.
describe('companion root marker', () => {
  it('is exactly version 1 of the project-companion-v1 layout', () => {
    expect(PROJECT_COMPANION_LAYOUT).toBe('project-companion-v1')
    expect(PROJECT_COMPANION_FORMAT_VERSION).toBe(1)
  })
})

describe('project-porcelain paths', () => {
  it('roots companion data under <repo>/.porcelain', () => {
    expect(projectPorcelainDir('/repo')).toBe(join('/repo', PROJECT_PORCELAIN_DIR))
    expect(projectPorcelainPath('/repo', PROJECT_FILES.actions)).toBe(
      join('/repo', PROJECT_PORCELAIN_DIR, 'actions.json'),
    )
  })

  it('never tracks derived or per-checkout state', () => {
    for (const pattern of ALWAYS_IGNORED) {
      expect(DEFAULT_PROJECT_GITIGNORE).toContain(pattern)
    }
  })

  it('names the v1 companion manifest and always ignores it', () => {
    expect(PROJECT_FILES.manifest).toBe('project-manifest.json')
    expect(ALWAYS_IGNORED).toContain('/project-manifest.json')
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('/project-manifest.json')
  })
})

describe('companion dispositions', () => {
  it('round-trips every channel through the gitignore', () => {
    const allLocal = Object.fromEntries(COMPANION_CHANNELS.map((c) => [c.key, 'local' as const]))
    const rendered = renderGitignore(DEFAULT_PROJECT_GITIGNORE, allLocal)
    expect(parseDispositions(rendered)).toEqual(allLocal)

    const allShared = Object.fromEntries(COMPANION_CHANNELS.map((c) => [c.key, 'shared' as const]))
    const back = renderGitignore(rendered, allShared)
    expect(parseDispositions(back)).toEqual(allShared)
  })

  it('ships the agreed defaults', () => {
    const parsed = parseDispositions(DEFAULT_PROJECT_GITIGNORE)
    expect(parsed).toEqual({
      actions: 'shared',
      layers: 'shared',
    })
  })

  it('reads the shipped defaults back out of the default file', () => {
    const parsed = parseDispositions(DEFAULT_PROJECT_GITIGNORE)
    for (const channel of COMPANION_CHANNELS) {
      expect(parsed[channel.key]).toBe(channel.defaultDisposition)
    }
  })

  it('keeps the human lines and rewrites only the managed block', () => {
    const withCustom = `# mine\nsecrets.json\n\n${DEFAULT_PROJECT_GITIGNORE}\n# trailing note\n`
    const next = renderGitignore(withCustom, { actions: 'local', reviews: 'shared' })
    expect(next).toContain('# mine')
    expect(next).toContain('secrets.json')
    expect(next).toContain('# trailing note')
  })

  it('appends a managed block when the file has none', () => {
    const next = renderGitignore('# hand written\nevidence/\n', { actions: 'local' })
    expect(next).toContain('# hand written')
    expect(next).toContain('/actions.json')
    expect(parseDispositions(next).actions).toBe('local')
  })

  it('honours a hand-written unanchored pattern as local', () => {
    expect(parseDispositions('actions.json\n').actions).toBe('local')
  })

  it('leaves an unmanaged file readable as all-shared', () => {
    const parsed = parseDispositions('')
    for (const channel of COMPANION_CHANNELS) expect(parsed[channel.key]).toBe('shared')
  })
})

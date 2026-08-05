import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_IGNORED,
  COMPANION_CHANNELS,
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  PROJECT_PORCELAIN_DIR,
  parseDispositions,
  projectArchivedReviewDir,
  projectEvidenceDir,
  projectPorcelainDir,
  projectPorcelainPath,
  projectReviewsDir,
  renderGitignore,
} from './project-porcelain'

describe('project-porcelain paths', () => {
  it('roots companion data under <repo>/.porcelain', () => {
    expect(projectPorcelainDir('/repo')).toBe(join('/repo', PROJECT_PORCELAIN_DIR))
    expect(projectPorcelainPath('/repo', PROJECT_FILES.board)).toBe(
      join('/repo', PROJECT_PORCELAIN_DIR, 'board.json'),
    )
  })

  it('nests evidence and archived reviews under the project dir', () => {
    expect(projectEvidenceDir('/repo')).toBe(join('/repo', '.porcelain', 'evidence'))
    expect(projectReviewsDir('/repo')).toBe(join('/repo', '.porcelain', 'reviews'))
    expect(projectArchivedReviewDir('/repo', 'abc')).toBe(
      join('/repo', '.porcelain', 'reviews', 'abc'),
    )
  })

  it('ships a default gitignore that ignores evidence trees', () => {
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('evidence/')
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('reviews/*/evidence/')
  })

  it('never tracks derived or per-checkout state', () => {
    for (const pattern of ALWAYS_IGNORED) {
      expect(DEFAULT_PROJECT_GITIGNORE).toContain(pattern)
    }
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

  it('reads the shipped defaults back out of the default file', () => {
    const parsed = parseDispositions(DEFAULT_PROJECT_GITIGNORE)
    for (const channel of COMPANION_CHANNELS) {
      expect(parsed[channel.key]).toBe(channel.defaultDisposition)
    }
  })

  it('keeps the human lines and rewrites only the managed block', () => {
    const withCustom = `# mine\nsecrets.json\n\n${DEFAULT_PROJECT_GITIGNORE}\n# trailing note\n`
    const next = renderGitignore(withCustom, { board: 'shared', reviews: 'shared' })
    expect(next).toContain('# mine')
    expect(next).toContain('secrets.json')
    expect(next).toContain('# trailing note')
    expect(parseDispositions(next).board).toBe('shared')
    // The always-ignored set survives a rewrite — it is inside the block.
    expect(next).toContain('/feature-view.json')
  })

  it('appends a managed block when the file has none', () => {
    const next = renderGitignore('# hand written\nevidence/\n', { board: 'local' })
    expect(next).toContain('# hand written')
    expect(next).toContain('/board.json')
    expect(parseDispositions(next).board).toBe('local')
  })

  it('honours a hand-written unanchored pattern as local', () => {
    expect(parseDispositions('board.json\n').board).toBe('local')
  })

  it('leaves an unmanaged file readable as all-shared', () => {
    const parsed = parseDispositions('')
    for (const channel of COMPANION_CHANNELS) expect(parsed[channel.key]).toBe('shared')
  })
})

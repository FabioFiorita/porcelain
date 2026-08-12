import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALWAYS_IGNORED,
  COMPANION_CHANNELS,
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  PROJECT_PORCELAIN_DIR,
  parseDispositions,
  parsePublishedReviews,
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
    expect(projectEvidenceDir('/repo')).toBe(
      join('/repo', '.porcelain', 'active-review', 'evidence'),
    )
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
      notes: 'local',
      scope: 'shared',
      layers: 'shared',
      board: 'local',
      reviews: 'local',
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

describe('the active review is never tracked by default', () => {
  it('ignores every active slot, including intent and evidence', () => {
    // Publishing is what shares a review; it copies these into reviews/<id>/ and
    // force-adds that folder. Tracking the live slots would put work-in-progress
    // and every screenshot into everyone else's diff.
    // One rule now: the whole unit in flight lives in one directory.
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('/active-review/')
  })
})

describe('publishing one review', () => {
  it('re-includes the folder and everything under it, last', () => {
    const next = renderGitignore(DEFAULT_PROJECT_GITIGNORE, { reviews: 'local' }, ['abc123'])
    const lines = next.split('\n').map((l) => l.trim())
    // Git cannot re-include a path whose parent is excluded, so the reviews rule
    // must exclude CONTENTS, and the negations must come after it.
    expect(lines).toContain('/reviews/*')
    expect(lines.indexOf('!/reviews/abc123/')).toBeGreaterThan(lines.indexOf('/reviews/*'))
    // After the evidence glob too, or a published review would lose its proof.
    expect(lines.indexOf('!/reviews/abc123/**')).toBeGreaterThan(
      lines.indexOf('reviews/*/evidence/'),
    )
  })

  it('round-trips the published set', () => {
    const next = renderGitignore(DEFAULT_PROJECT_GITIGNORE, { reviews: 'local' }, ['a', 'b'])
    expect(parsePublishedReviews(next).sort()).toEqual(['a', 'b'])
  })

  it('keeps published reviews across an unrelated toggle', () => {
    const published = renderGitignore(DEFAULT_PROJECT_GITIGNORE, { reviews: 'local' }, ['keep'])
    const afterToggle = renderGitignore(published, {
      ...parseDispositions(published),
      board: 'shared',
    })
    expect(parsePublishedReviews(afterToggle)).toEqual(['keep'])
  })
})

import { describe, expect, it } from 'vitest'
import { searchCandidates } from './search-candidates'

const files = ['src/app/page.tsx', 'src/lib/util.ts', 'docs/readme.md']

describe('searchCandidates', () => {
  it('offers every visible file plus its ancestor folders', () => {
    const { paths, dirs } = searchCandidates('/repo-shape', files, new Set())

    expect([...paths].sort()).toEqual([
      'docs',
      'docs/readme.md',
      'src',
      'src/app',
      'src/app/page.tsx',
      'src/lib',
      'src/lib/util.ts',
    ])
    expect([...dirs].sort()).toEqual(['docs', 'src', 'src/app', 'src/lib'])
  })

  it('drops a hidden subtree from both the paths and the folders', () => {
    const { paths, dirs } = searchCandidates('/repo-hidden', files, new Set(['src/lib']))

    expect(paths).not.toContain('src/lib/util.ts')
    expect(dirs.has('src/lib')).toBe(false)
    expect(paths).toContain('src/app/page.tsx')
  })

  // Keystroke cost: only the fuzzy scoring may run per keystroke. The memo is keyed
  // on the file-list IDENTITY (git.ts reuses the same array while ls-files is
  // unchanged) plus the hidden set.
  it('reuses the memo while the file list identity and hidden set hold', () => {
    const hidden = new Set(['docs'])
    const first = searchCandidates('/repo-memo', files, hidden)

    expect(searchCandidates('/repo-memo', files, new Set(['docs']))).toBe(first)
  })

  it('rebuilds when the file list is a new array', () => {
    const first = searchCandidates('/repo-newlist', files, new Set())

    expect(searchCandidates('/repo-newlist', [...files], new Set())).not.toBe(first)
  })

  it('rebuilds when the hidden set changes', () => {
    const first = searchCandidates('/repo-hidden-change', files, new Set())
    const second = searchCandidates('/repo-hidden-change', files, new Set(['docs']))

    expect(second).not.toBe(first)
    expect(second.paths).not.toContain('docs/readme.md')
  })

  it('keeps repos in separate entries', () => {
    const first = searchCandidates('/repo-one', files, new Set())

    expect(searchCandidates('/repo-two', files, new Set())).not.toBe(first)
  })

  it('resolves an absolute hidden path against the repo root', () => {
    const { paths } = searchCandidates('/repo-abs', files, new Set(['/repo-abs/docs']))

    expect(paths).not.toContain('docs/readme.md')
  })
})

import { describe, expect, it } from 'vitest'

import { basename, dirname, formatStats, shortHash, splitMessage, stagingLabel } from './format'

describe('paths', () => {
  it('splits a repo-relative path', () => {
    expect(basename('src/lib/daemon/client.ts')).toBe('client.ts')
    expect(dirname('src/lib/daemon/client.ts')).toBe('src/lib/daemon')
  })

  it('treats a root-level file as having no directory', () => {
    expect(basename('README.md')).toBe('README.md')
    expect(dirname('README.md')).toBe('')
  })
})

describe('formatStats', () => {
  it('omits a side that did not change', () => {
    expect(formatStats(12, 3)).toBe('+12 −3')
    expect(formatStats(12, 0)).toBe('+12')
    expect(formatStats(undefined, undefined)).toBe('')
  })
})

describe('splitMessage', () => {
  it('separates the subject from the body', () => {
    expect(splitMessage('feat: a thing\n\nWhy it happened.\n')).toEqual({
      body: 'Why it happened.',
      subject: 'feat: a thing',
    })
  })

  it('handles a subject-only commit', () => {
    expect(splitMessage('chore: tidy')).toEqual({ body: '', subject: 'chore: tidy' })
  })
})

describe('stagingLabel', () => {
  it('names the tri-state git reports through XY', () => {
    expect(stagingLabel({ staged: true })).toBe('Staged')
    expect(stagingLabel({ staged: true, unstaged: true })).toBe('Partly staged')
    expect(stagingLabel({ unstaged: true })).toBe('')
    expect(stagingLabel({})).toBe('')
  })
})

describe('shortHash', () => {
  it('cuts to the length git logs use', () => {
    expect(shortHash('5897af9c0d1e2f3')).toBe('5897af9')
  })
})

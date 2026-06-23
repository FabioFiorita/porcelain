import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addReviewFiles,
  clearReview,
  describeReview,
  mergeReviewFiles,
  readReview,
  setReview,
  toReviewFiles,
} from './review-file'

describe('toReviewFiles', () => {
  it('accepts valid rows and keeps source + note', () => {
    expect(
      toReviewFiles([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }]),
    ).toEqual([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }])
  })

  it('keeps an agent-declared flow layer', () => {
    expect(toReviewFiles([{ path: 'a.ts', layer: 'Store' }])).toEqual([
      { path: 'a.ts', layer: 'Store' },
    ])
  })

  it('throws on a non-array', () => {
    expect(() => toReviewFiles('nope')).toThrow('files must be an array')
  })

  it('throws on a missing path', () => {
    expect(() => toReviewFiles([{ note: 'x' }])).toThrow('path must be a non-empty string')
  })

  it('throws on an invalid source', () => {
    expect(() => toReviewFiles([{ path: 'a.ts', source: 'whoops' }])).toThrow(
      'source must be one of',
    )
  })
})

describe('mergeReviewFiles', () => {
  it('replaces a file with the same path and appends new ones', () => {
    const merged = mergeReviewFiles(
      [{ path: 'a.ts', note: 'old' }, { path: 'b.ts' }],
      [{ path: 'a.ts', note: 'new' }, { path: 'c.ts' }],
    )
    expect(merged).toEqual([{ path: 'a.ts', note: 'new' }, { path: 'b.ts' }, { path: 'c.ts' }])
  })
})

describe('file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-mcp-test')
  const file = join(dir, 'review-sets.json')

  beforeEach(() => {
    process.env.PORCELAIN_REVIEW_SETS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_REVIEW_SETS
    rmSync(dir, { recursive: true, force: true })
  })

  const read = (): Record<string, { name: string; files: unknown[] }> =>
    JSON.parse(readFileSync(file, 'utf8'))

  it('setReview writes a repo-keyed set', () => {
    setReview('/repo', 'Call-outs', [{ path: 'a.ts', source: 'shipped' }])
    expect(read()['/repo']).toEqual({
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped' }],
    })
  })

  it('addReviewFiles merges into the existing set and returns the total', () => {
    setReview('/repo', 'Call-outs', [{ path: 'a.ts' }])
    const total = addReviewFiles('/repo', [{ path: 'b.ts' }])
    expect(total).toBe(2)
    expect(read()['/repo']?.files).toEqual([{ path: 'a.ts' }, { path: 'b.ts' }])
  })

  it('addReviewFiles creates a set when none exists', () => {
    const total = addReviewFiles('/repo', [{ path: 'a.ts' }])
    expect(total).toBe(1)
    expect(read()['/repo']?.name).toBe('Feature view')
  })

  it('clearReview removes only the target repo', () => {
    setReview('/repo', 'x', [{ path: 'a.ts' }])
    setReview('/other', 'y', [{ path: 'b.ts' }])
    clearReview('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
    expect(existsSync(file)).toBe(true)
  })

  it('readReview returns the stored set, or null when none exists', () => {
    expect(readReview('/repo')).toBeNull()
    setReview('/repo', 'Call-outs', [{ path: 'a.ts', source: 'shipped', note: 'check' }])
    expect(readReview('/repo')).toEqual({
      name: 'Call-outs',
      files: [{ path: 'a.ts', source: 'shipped', note: 'check' }],
    })
  })
})

describe('describeReview', () => {
  it('explains the static baseline when there is no set', () => {
    expect(describeReview('/repo', null)).toContain('No feature review set for /repo')
    expect(describeReview('/repo', { name: 'x', files: [] })).toContain('No feature review set')
  })

  it('summarizes the set with a per-source breakdown and the files as JSON', () => {
    const text = describeReview('/repo', {
      name: 'Call-outs',
      files: [{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'match the service' }],
    })
    expect(text).toContain('Feature review "Call-outs" for /repo: 2 file(s)')
    expect(text).toContain('1 auto-detected')
    expect(text).toContain('1 shipped')
    // the files round-trip as JSON so an agent can read → modify → set
    expect(JSON.parse(text.slice(text.indexOf('[')))).toEqual([
      { path: 'a.ts' },
      { path: 'b.ts', source: 'shipped', note: 'match the service' },
    ])
  })
})

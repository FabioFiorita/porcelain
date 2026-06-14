import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addReviewFiles,
  clearReview,
  mergeReviewFiles,
  setReview,
  toReviewFiles,
} from './review-file'

describe('toReviewFiles', () => {
  it('accepts valid rows and keeps source + note', () => {
    expect(
      toReviewFiles([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }]),
    ).toEqual([{ path: 'a.ts' }, { path: 'b.ts', source: 'shipped', note: 'check this' }])
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
})

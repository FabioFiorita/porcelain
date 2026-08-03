import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addReviewFiles,
  clearReview,
  clearReviewCanvas,
  readReview,
  setReview,
  setReviewCanvas,
  toReviewFiles,
  toReviewSections,
} from './review-file'

const root = join(tmpdir(), 'porcelain-review-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('toReviewFiles', () => {
  it('accepts valid files', () => {
    expect(toReviewFiles([{ path: 'a.ts', source: 'changed' }])).toEqual([
      { path: 'a.ts', source: 'changed' },
    ])
  })
  it('rejects bad source', () => {
    expect(() => toReviewFiles([{ path: 'a.ts', source: 'nope' }])).toThrow('source')
  })
})

describe('toReviewSections', () => {
  it('accepts a minimal section', () => {
    expect(toReviewSections([{ title: 'T', prose: 'p' }])).toEqual([
      { title: 'T', prose: 'p', anchors: [] },
    ])
  })
})

describe('file round-trip', () => {
  it('setReview writes and readReview returns it', () => {
    setReview(repo, { name: 'A', files: [{ path: 'a.ts' }], sections: [] })
    expect(readReview(repo)?.name).toBe('A')
  })

  it('addReviewFiles merges into the existing set', () => {
    setReview(repo, { name: 'A', files: [{ path: 'a.ts' }], sections: [] })
    expect(addReviewFiles(repo, [{ path: 'b.ts' }])).toBe(2)
    expect(readReview(repo)?.files.map((f) => f.path)).toEqual(['a.ts', 'b.ts'])
  })

  it('addReviewFiles creates a set when none exists', () => {
    expect(addReviewFiles(repo, [{ path: 'a.ts' }])).toBe(1)
    expect(readReview(repo)?.files).toEqual([{ path: 'a.ts' }])
  })

  it('addReviewFiles keeps the existing thesis and sections', () => {
    setReview(repo, {
      name: 'A',
      thesis: 'why',
      files: [{ path: 'a.ts' }],
      sections: [{ title: 'S', prose: 'p', anchors: [] }],
    })
    addReviewFiles(repo, [{ path: 'b.ts' }])
    const set = readReview(repo)
    expect(set?.thesis).toBe('why')
    expect(set?.sections).toHaveLength(1)
  })

  it('clearReview removes the set', () => {
    setReview(repo, { name: 'A', files: [{ path: 'a.ts' }], sections: [] })
    clearReview(repo)
    expect(readReview(repo)).toBeNull()
  })

  it('setReview does not keep a previous freeform canvas', () => {
    setReviewCanvas(repo, { medium: 'html', html: '<p>old</p>' })
    setReview(repo, { name: 'New', files: [], sections: [] })
    expect(readReview(repo)?.canvas).toBeUndefined()
  })

  it('setReviewCanvas and clearReviewCanvas', () => {
    setReview(repo, { name: 'A', files: [], sections: [] })
    setReviewCanvas(repo, { medium: 'html', html: '<p>x</p>' })
    expect(readReview(repo)?.canvas).toEqual({ medium: 'html', html: '<p>x</p>' })
    expect(clearReviewCanvas(repo)).toBe(true)
    expect(readReview(repo)?.canvas).toBeUndefined()
  })

  it('round-trips thesis and sections', () => {
    setReview(repo, {
      name: 'A',
      thesis: 'why',
      files: [],
      sections: [{ title: 'Entry', prose: 'start', anchors: [] }],
    })
    const set = readReview(repo)
    expect(set?.thesis).toBe('why')
    expect(set?.sections[0]?.title).toBe('Entry')
  })
})

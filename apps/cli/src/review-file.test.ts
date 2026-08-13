import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addReviewFiles,
  clearReview,
  readReview,
  setReview,
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

  it('readReview ignores an on-disk canvas field', () => {
    mkdirSync(projectActiveReviewDir(repo), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.review),
      JSON.stringify({
        name: 'A',
        files: [{ path: 'a.ts' }],
        sections: [],
        canvas: { medium: 'html', html: '<p>x</p>' },
      }),
    )
    const set = readReview(repo)
    expect(set?.name).toBe('A')
    expect(set?.files).toEqual([{ path: 'a.ts' }])
    expect(readReview(repo)).not.toHaveProperty('canvas')
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

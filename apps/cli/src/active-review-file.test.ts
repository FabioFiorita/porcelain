import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readActiveReviewSnapshot, sourceByPath } from './active-review-file'

const root = join(tmpdir(), 'porcelain-active-review-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function seed(snap: unknown): void {
  mkdirSync(join(repo, '.porcelain'), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, PROJECT_FILES.activeReview), JSON.stringify(snap))
}

describe('readActiveReviewSnapshot', () => {
  it('reads the snapshot, or null when none', () => {
    expect(readActiveReviewSnapshot(repo)).toBeNull()
    seed({
      name: 'X',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(readActiveReviewSnapshot(repo)).toEqual({
      name: 'X',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
  })

  it('drops malformed rows but keeps valid ones', () => {
    seed({
      name: 'X',
      files: [
        { path: 'ok.ts', source: 'changed', layer: 'Pages' },
        { path: 'bad.ts', source: 'nope', layer: 'Pages' },
        { path: 'nosource.ts', layer: 'Pages' },
      ],
    })
    expect(readActiveReviewSnapshot(repo)?.files).toEqual([
      { path: 'ok.ts', source: 'changed', layer: 'Pages' },
    ])
  })
})

describe('sourceByPath', () => {
  it('maps each file to its source for comment tagging', () => {
    const map = sourceByPath({
      name: 'X',
      files: [
        { path: 'a.ts', source: 'changed', layer: 'P' },
        { path: 'b.ts', source: 'shipped', layer: 'S' },
      ],
    })
    expect(map.get('a.ts')).toBe('changed')
    expect(map.get('b.ts')).toBe('shipped')
  })
})

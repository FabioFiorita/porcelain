import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isRepoContained, readReviewSet } from './review-store'

const root = join(tmpdir(), 'porcelain-review-store-test')
const repo = join(root, 'repo')

function writeReview(data: unknown): void {
  mkdirSync(projectActiveReviewDir(repo), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, ACTIVE_FILES.review), JSON.stringify(data))
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('isRepoContained', () => {
  it('accepts repo-relative paths', () => {
    expect(isRepoContained('/repo', 'src/a.ts')).toBe(true)
    expect(isRepoContained('/repo', 'a/../b.ts')).toBe(true)
  })
  it('rejects absolute paths and parent escapes', () => {
    expect(isRepoContained('/repo', '/etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '../../../etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '.')).toBe(false)
  })
})

describe('readReviewSet path containment', () => {
  it('drops review-set entries that escape the repo', async () => {
    writeReview({
      name: 'test',
      files: [
        { path: 'src/a.ts', source: 'changed' },
        { path: '../../secret', source: 'changed' },
        { path: '/etc/passwd', source: 'changed' },
      ],
      sections: [],
    })
    const set = await readReviewSet(repo)
    expect(set?.files.map((f) => f.path)).toEqual(['src/a.ts'])
  })

  it('drops invalid sections but keeps the set', async () => {
    writeReview({
      name: 'test',
      files: [],
      sections: [
        { title: 'Good', prose: 'ok', anchors: [] },
        { title: 1, prose: 'bad' },
      ],
    })
    const set = await readReviewSet(repo)
    expect(set?.sections).toHaveLength(1)
    expect(set?.sections[0]?.title).toBe('Good')
  })
})

describe('canvas media', () => {
  it('keeps an html canvas', async () => {
    writeReview({
      name: 'test',
      files: [],
      sections: [],
      canvas: { medium: 'html', html: '<p>board</p>' },
    })
    const set = await readReviewSet(repo)
    expect(set?.canvas).toEqual({ medium: 'html', html: '<p>board</p>' })
  })

  it('drops a legacy scene canvas instead of failing the whole review', async () => {
    writeReview({
      name: 'test',
      files: [{ path: 'a.ts' }],
      sections: [],
      canvas: { medium: 'excalidraw', scene: { elements: [] } },
    })
    const set = await readReviewSet(repo)
    expect(set?.name).toBe('test')
    expect(set?.files.map((file) => file.path)).toEqual(['a.ts'])
    expect(set?.canvas).toBeUndefined()
  })
})

describe('empty name is null', () => {
  it('treats empty review file as no set', async () => {
    writeReview({ name: '', files: [], sections: [] })
    expect(await readReviewSet(repo)).toBeNull()
  })
})

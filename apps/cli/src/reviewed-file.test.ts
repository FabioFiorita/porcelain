import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeReviewed, readReviewed } from './reviewed-file'

const root = join(tmpdir(), 'porcelain-reviewed-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function seed(marks: unknown): void {
  mkdirSync(projectActiveReviewDir(repo), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, ACTIVE_FILES.reviewed), JSON.stringify(marks))
}

describe('reviewed-file', () => {
  it('reads the fingerprinted object shape, exposing only the path', () => {
    seed([
      { path: 'src/a.ts', fingerprint: 'abc' },
      { path: 'src/b.ts', fingerprint: 'def' },
    ])
    expect(readReviewed(repo)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('returns an empty list when absent', () => {
    expect(readReviewed(repo)).toEqual([])
  })

  it('skips malformed entries rather than throwing', () => {
    seed([{ path: 'ok.ts', fingerprint: 'a' }, 42, null, {}, { fingerprint: 'x' }, 'bare-string'])
    expect(readReviewed(repo)).toEqual(['ok.ts'])
  })

  it('describes the reviewed files', () => {
    const text = describeReviewed(repo, ['src/a.ts', 'src/b.ts'])
    expect(text).toContain('2 file(s) marked reviewed')
    expect(text).toContain('src/a.ts')
  })

  it('describes an empty review with a hint', () => {
    expect(describeReviewed(repo, [])).toContain('No files marked reviewed')
  })
})

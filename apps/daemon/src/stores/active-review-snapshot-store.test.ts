import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  activeReviewSnapshotPath,
  readActiveReviewSnapshot,
  writeActiveReviewSnapshot,
} from './active-review-snapshot-store'

const root = join(tmpdir(), 'porcelain-active-review-snapshot-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('active review snapshot store', () => {
  it('paths under project .porcelain', () => {
    expect(activeReviewSnapshotPath(repo)).toBe(
      projectPorcelainPath(repo, PROJECT_FILES.activeReview),
    )
  })

  it('writes and reads back a repo snapshot', async () => {
    await writeActiveReviewSnapshot(repo, {
      name: 'Synthetic Review',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(await readActiveReviewSnapshot(repo)).toEqual({
      name: 'Synthetic Review',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    const missing = join(root, 'missing')
    mkdirSync(missing, { recursive: true })
    expect(await readActiveReviewSnapshot(missing)).toBeNull()
  })

  it('drops the entry when the file list is empty', async () => {
    await writeActiveReviewSnapshot(repo, {
      name: 'F',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    await writeActiveReviewSnapshot(repo, { name: 'F', files: [] })
    expect(await readActiveReviewSnapshot(repo)).toBeNull()
  })

  it('skips an unchanged write (dedup) but persists a real change', async () => {
    const snapshot = {
      name: 'F',
      files: [{ path: 'a.ts' as const, source: 'changed' as const, layer: 'Pages' }],
    }
    await writeActiveReviewSnapshot(repo, snapshot)
    await writeActiveReviewSnapshot(repo, snapshot)
    await writeActiveReviewSnapshot(repo, {
      name: 'F2',
      files: [{ path: 'b.ts', source: 'context', layer: 'Data' }],
    })
    expect(await readActiveReviewSnapshot(repo)).toEqual({
      name: 'F2',
      files: [{ path: 'b.ts', source: 'context', layer: 'Data' }],
    })
  })
})

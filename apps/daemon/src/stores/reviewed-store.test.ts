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
  clearReviewedPaths,
  readReviewedMarks,
  removeReviewedMarks,
  setReviewedMarks,
} from './reviewed-store'

const root = join(tmpdir(), 'porcelain-reviewed-store-test')
const repo = join(root, 'repo')

const paths = async (repoPath: string): Promise<string[]> =>
  (await readReviewedMarks(repoPath)).map((mark) => mark.path)

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('reviewed-store', () => {
  it('returns an empty list for a repo with no marks', async () => {
    expect(await readReviewedMarks(repo)).toEqual([])
  })

  it('sets a repo’s marks, replacing any pre-existing marks', async () => {
    await setReviewedMarks(repo, [{ path: 'src/old.ts', fingerprint: 'fp-old' }])
    await setReviewedMarks(repo, [
      { path: 'src/a.ts', fingerprint: 'fp-a' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
    expect(await paths(repo)).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('clears the repo entry when set to an empty array', async () => {
    await setReviewedMarks(repo, [{ path: 'src/a.ts', fingerprint: 'fp-a' }])
    await setReviewedMarks(repo, [])
    expect(await paths(repo)).toEqual([])
  })

  it('collapses duplicate paths to unique (last fingerprint wins)', async () => {
    await setReviewedMarks(repo, [
      { path: 'src/a.ts', fingerprint: 'fp-1' },
      { path: 'src/a.ts', fingerprint: 'fp-2' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
    expect(await readReviewedMarks(repo)).toEqual([
      { path: 'src/a.ts', fingerprint: 'fp-2' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
  })

  it('clears many marks at once (committed files) and keeps the rest', async () => {
    await setReviewedMarks(repo, [
      { path: 'src/a.ts', fingerprint: 'fp-a' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
      { path: 'src/c.ts', fingerprint: 'fp-c' },
    ])
    await clearReviewedPaths(repo, ['src/a.ts', 'src/c.ts', 'src/never.ts'])
    expect(await paths(repo)).toEqual(['src/b.ts'])
  })

  it('keeps repos isolated', async () => {
    const r1 = join(root, 'r1')
    const r2 = join(root, 'r2')
    mkdirSync(r1, { recursive: true })
    mkdirSync(r2, { recursive: true })
    await setReviewedMarks(r1, [{ path: 'a.ts', fingerprint: 'fp-1' }])
    await setReviewedMarks(r2, [{ path: 'b.ts', fingerprint: 'fp-2' }])
    expect(await paths(r1)).toEqual(['a.ts'])
    expect(await paths(r2)).toEqual(['b.ts'])
  })

  it('drops a corrupt channel file rather than half-parsing', async () => {
    mkdirSync(projectActiveReviewDir(repo), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.reviewed),
      JSON.stringify(['src/legacy.ts']),
    )
    expect(await readReviewedMarks(repo)).toEqual([])
  })
})

describe('removeReviewedMarks', () => {
  it('removes exactly the named path+fingerprint pairs', async () => {
    await setReviewedMarks(repo, [
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ])
    await removeReviewedMarks(repo, [{ path: 'b.ts', fingerprint: 'fp-b' }])
    expect(await readReviewedMarks(repo)).toEqual([{ path: 'a.ts', fingerprint: 'fp-a' }])
  })

  it('leaves a mark whose fingerprint was refreshed after the snapshot', async () => {
    await setReviewedMarks(repo, [{ path: 'a.ts', fingerprint: 'fp-new' }])
    await removeReviewedMarks(repo, [{ path: 'a.ts', fingerprint: 'fp-old' }])
    expect(await readReviewedMarks(repo)).toEqual([{ path: 'a.ts', fingerprint: 'fp-new' }])
  })

  it('is a no-op for an empty list', async () => {
    await setReviewedMarks(repo, [{ path: 'a.ts', fingerprint: 'fp-a' }])
    await removeReviewedMarks(repo, [])
    expect(await paths(repo)).toEqual(['a.ts'])
  })
})

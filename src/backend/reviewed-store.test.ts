import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearReviewedPaths,
  markReviewed,
  readReviewedMarks,
  readReviewedPaths,
  reconcileMarks,
  reconcileReviewed,
  setReviewedMarks,
  unmarkReviewed,
} from './reviewed-store'

const dir = join(tmpdir(), 'porcelain-reviewed-store-test')
const file = join(dir, 'reviewed.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEWED = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEWED
  rmSync(dir, { recursive: true, force: true })
})

describe('reviewed-store', () => {
  it('marks paths reviewed with a fingerprint and reads them back', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-a')
    await markReviewed('/repo', 'src/b.ts', 'fp-b')
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
    expect(await readReviewedMarks('/repo')).toEqual([
      { path: 'src/a.ts', fingerprint: 'fp-a' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
  })

  it('returns an empty list for a repo with no marks', async () => {
    expect(await readReviewedPaths('/repo')).toEqual([])
    expect(await readReviewedMarks('/repo')).toEqual([])
  })

  it('re-marking a path refreshes its fingerprint (no duplicate)', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-old')
    await markReviewed('/repo', 'src/a.ts', 'fp-new')
    expect(await readReviewedMarks('/repo')).toEqual([{ path: 'src/a.ts', fingerprint: 'fp-new' }])
  })

  it('unmarks a path and drops the entry when the last mark is removed', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-a')
    await unmarkReviewed('/repo', 'src/a.ts')
    expect(await readReviewedPaths('/repo')).toEqual([])
  })

  it('unmarking a path that was never marked is a no-op', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-a')
    await unmarkReviewed('/repo', 'src/b.ts')
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts'])
  })

  it('clears many marks at once (committed files) and keeps the rest', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-a')
    await markReviewed('/repo', 'src/b.ts', 'fp-b')
    await markReviewed('/repo', 'src/c.ts', 'fp-c')
    await clearReviewedPaths('/repo', ['src/a.ts', 'src/c.ts', 'src/never.ts'])
    expect(await readReviewedPaths('/repo')).toEqual(['src/b.ts'])
  })

  it('keeps repos isolated', async () => {
    await markReviewed('/r1', 'a.ts', 'fp-1')
    await markReviewed('/r2', 'b.ts', 'fp-2')
    expect(await readReviewedPaths('/r1')).toEqual(['a.ts'])
    expect(await readReviewedPaths('/r2')).toEqual(['b.ts'])
  })

  it('sets a repo’s marks, replacing any pre-existing marks', async () => {
    await markReviewed('/repo', 'src/old.ts', 'fp-old')
    await setReviewedMarks('/repo', [
      { path: 'src/a.ts', fingerprint: 'fp-a' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('clears the repo entry when set to an empty array', async () => {
    await markReviewed('/repo', 'src/a.ts', 'fp-a')
    await setReviewedMarks('/repo', [])
    expect(await readReviewedPaths('/repo')).toEqual([])
  })

  it('collapses duplicate paths to unique (last fingerprint wins)', async () => {
    await setReviewedMarks('/repo', [
      { path: 'src/a.ts', fingerprint: 'fp-1' },
      { path: 'src/a.ts', fingerprint: 'fp-2' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
    expect(await readReviewedMarks('/repo')).toEqual([
      { path: 'src/a.ts', fingerprint: 'fp-2' },
      { path: 'src/b.ts', fingerprint: 'fp-b' },
    ])
  })

  it('drops a corrupt channel file (bare-string marks) rather than half-parsing', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file, JSON.stringify({ '/repo': ['src/legacy.ts'] }))
    expect(await readReviewedMarks('/repo')).toEqual([])
  })
})

describe('reconcileMarks (pure)', () => {
  it('keeps marks whose fingerprint still matches and drops the rest', () => {
    const marks = [
      { path: 'a.ts', fingerprint: 'fp-a' },
      { path: 'b.ts', fingerprint: 'fp-b' },
    ]
    const current = new Map([
      ['a.ts', 'fp-a'],
      ['b.ts', 'CHANGED'],
    ])
    expect(reconcileMarks(marks, current)).toEqual({
      marks: [{ path: 'a.ts', fingerprint: 'fp-a' }],
      pruned: true,
    })
  })

  it('reports no pruning when every fingerprint matches', () => {
    const marks = [{ path: 'a.ts', fingerprint: 'fp-a' }]
    const current = new Map([['a.ts', 'fp-a']])
    expect(reconcileMarks(marks, current)).toEqual({ marks, pruned: false })
  })

  it('always prunes an empty-fingerprint mark (invalid)', () => {
    const marks = [{ path: 'a.ts', fingerprint: '' }]
    const current = new Map([['a.ts', '']])
    expect(reconcileMarks(marks, current)).toEqual({ marks: [], pruned: true })
  })

  it('keeps a mark whose path has no current fingerprint (absence ≠ stale)', () => {
    // A path missing from the fingerprint map means "not fingerprinted this round" (e.g.
    // a mark added concurrently, after the snapshot), NOT stale — so it must be kept.
    const marks = [{ path: 'a.ts', fingerprint: 'fp-a' }]
    expect(reconcileMarks(marks, new Map())).toEqual({ marks, pruned: false })
  })

  it('still prunes an empty-fingerprint mark whose path is absent', () => {
    const marks = [{ path: 'a.ts', fingerprint: '' }]
    expect(reconcileMarks(marks, new Map())).toEqual({ marks: [], pruned: true })
  })
})

describe('reconcileReviewed (write-through)', () => {
  it('prunes stale marks and writes the survivors back to disk', async () => {
    await markReviewed('/repo', 'a.ts', 'fp-a')
    await markReviewed('/repo', 'b.ts', 'fp-b')
    const snapshot = await readReviewedMarks('/repo')
    const survivors = await reconcileReviewed(
      '/repo',
      snapshot,
      new Map([
        ['a.ts', 'fp-a'],
        ['b.ts', 'CHANGED'],
      ]),
    )
    expect(survivors).toEqual(['a.ts'])
    // Write-through: the on-disk file no longer holds the stale mark.
    expect(await readReviewedMarks('/repo')).toEqual([{ path: 'a.ts', fingerprint: 'fp-a' }])
  })

  it('returns the paths unchanged when nothing is stale', async () => {
    await markReviewed('/repo', 'a.ts', 'fp-a')
    const snapshot = await readReviewedMarks('/repo')
    expect(await reconcileReviewed('/repo', snapshot, new Map([['a.ts', 'fp-a']]))).toEqual([
      'a.ts',
    ])
  })

  it('never prunes a mark added concurrently, after the snapshot fingerprints were taken', async () => {
    // Snapshot: only a.ts is marked, and its fingerprint has since changed (stale).
    await markReviewed('/repo', 'a.ts', 'fp-a')
    const snapshot = await readReviewedMarks('/repo')
    const fingerprints = new Map([['a.ts', 'CHANGED']])
    // A concurrent mark of a DIFFERENT path lands between the snapshot read and reconcile.
    await markReviewed('/repo', 'new.ts', 'fp-new')
    // Reconcile drops the stale a.ts but must leave the concurrently-added new.ts on disk
    // AND return it (re-read) — otherwise the client poll that started before the concurrent
    // mark would overwrite the optimistic tick with a list that omits it.
    const survivors = await reconcileReviewed('/repo', snapshot, fingerprints)
    expect(survivors).toEqual(['new.ts'])
    expect(await readReviewedMarks('/repo')).toEqual([{ path: 'new.ts', fingerprint: 'fp-new' }])
  })

  it('returns a concurrent mark even when nothing in the snapshot was pruned', async () => {
    await markReviewed('/repo', 'a.ts', 'fp-a')
    const snapshot = await readReviewedMarks('/repo')
    await markReviewed('/repo', 'new.ts', 'fp-new')
    // No stale fingerprints → no write-through, but the return value still re-reads disk.
    const survivors = await reconcileReviewed('/repo', snapshot, new Map([['a.ts', 'fp-a']]))
    expect(survivors).toEqual(['a.ts', 'new.ts'])
  })
})

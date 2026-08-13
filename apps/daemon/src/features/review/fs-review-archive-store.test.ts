// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectArchivedReviewDir,
  projectEvidenceDir,
  projectIntentDir,
  projectPorcelainPath,
  projectReviewsDir,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFsReviewArchiveStore } from './fs-review-archive-store'

const root = join(tmpdir(), 'porcelain-review-archive-store-test')
const repo = join(root, 'repo')
const store = createFsReviewArchiveStore()
const AT = '2026-08-09T00:00:00.000Z'

function writeReview(data: unknown): void {
  mkdirSync(projectActiveReviewDir(repo), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, ACTIVE_FILES.review), JSON.stringify(data))
}

function writeArchiveMeta(id: string, meta: string): void {
  mkdirSync(projectArchivedReviewDir(repo, id), { recursive: true })
  writeFileSync(join(projectArchivedReviewDir(repo, id), 'meta.json'), meta)
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('archiveActive', () => {
  it('copies every active slot, writes meta, and clears the active directory afterwards', async () => {
    writeReview({ name: 'A', files: [{ path: 'a.ts' }], sections: [], thesis: 't1' })
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'index.md'), '# Why')

    expect(await store.archiveActive(repo, 'arc-1', AT)).toBe('arc-1')

    const dest = projectArchivedReviewDir(repo, 'arc-1')
    expect(readFileSync(join(dest, 'intent', 'index.md'), 'utf8')).toBe('# Why')
    expect(JSON.parse(readFileSync(join(dest, 'meta.json'), 'utf8'))).toEqual({
      id: 'arc-1',
      name: 'A',
      thesis: 't1',
      archivedAt: AT,
    })
    expect(existsSync(projectActiveReviewDir(repo))).toBe(false)
  })

  it('names an unreadable active review set "Untitled review" and still archives it', async () => {
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'index.md'), 'draft')

    expect(await store.archiveActive(repo, 'arc-1', AT)).toBe('arc-1')
    expect(await store.list(repo)).toEqual([
      { id: 'arc-1', name: 'Untitled review', archivedAt: AT },
    ])
  })

  it('is null when nothing is active', async () => {
    expect(await store.archiveActive(repo, 'arc-1', AT)).toBeNull()
    expect(await store.list(repo)).toEqual([])
  })
})

describe('list', () => {
  it('skips corrupt, partial, and unknown-key archives without deleting them', async () => {
    writeArchiveMeta('good', JSON.stringify({ id: 'good', name: 'Kept', archivedAt: AT }))
    writeArchiveMeta('corrupt', '{ not json')
    writeArchiveMeta('partial', JSON.stringify({ id: 'partial' }))
    mkdirSync(projectArchivedReviewDir(repo, 'no-meta'), { recursive: true })

    expect((await store.list(repo)).map((meta) => meta.id)).toEqual(['good'])
    expect(existsSync(join(projectArchivedReviewDir(repo, 'corrupt'), 'meta.json'))).toBe(true)
    expect(existsSync(projectArchivedReviewDir(repo, 'partial'))).toBe(true)
  })

  it('returns newest first and reads a missing archive root as empty', async () => {
    expect(await store.list(repo)).toEqual([])
    expect(existsSync(projectReviewsDir(repo))).toBe(false)

    writeArchiveMeta(
      'older',
      JSON.stringify({ id: 'older', name: 'Older', archivedAt: '2026-08-01T00:00:00.000Z' }),
    )
    writeArchiveMeta(
      'newer',
      JSON.stringify({ id: 'newer', name: 'Newer', archivedAt: '2026-08-09T00:00:00.000Z' }),
    )

    expect((await store.list(repo)).map((meta) => meta.id)).toEqual(['newer', 'older'])
  })
})

describe('activeCost', () => {
  it('counts what would enter history, not just the review file', async () => {
    writeReview({ name: 'A', files: [], sections: [] })
    mkdirSync(join(projectEvidenceDir(repo), 'assets'), { recursive: true })
    writeFileSync(join(projectEvidenceDir(repo), 'index.html'), '<p>ok</p>')
    writeFileSync(join(projectEvidenceDir(repo), 'assets', 'shot.png'), 'x'.repeat(4096))

    const cost = await store.activeCost(repo)
    expect(cost.files).toBe(3)
    expect(cost.bytes).toBeGreaterThan(4096)
  })

  it('is zero for an empty companion', async () => {
    expect(await store.activeCost(repo)).toEqual({ bytes: 0, files: 0 })
  })
})

describe('restore', () => {
  // Restore used to copy the archive back to the flat `.porcelain/*.json` paths
  // while every reader looks inside `active-review/` — a restored review came
  // back with its comments and marks nowhere anything would find them.
  it('lands every slot where the readers look and drops the source archive', async () => {
    writeReview({ name: 'First', files: [{ path: 'a.ts' }], sections: [] })
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.comments),
      JSON.stringify({
        version: 1,
        comments: [{ id: 'c1', path: 'a.ts', body: 'look here', resolved: false, createdAt: 1 }],
      }),
    )
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.reviewed),
      JSON.stringify({ marks: [{ path: 'a.ts', fingerprint: 'fp-1' }] }),
    )
    mkdirSync(projectEvidenceDir(repo), { recursive: true })
    writeFileSync(join(projectEvidenceDir(repo), 'index.html'), '<p>proof</p>')
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'why.md'), '# Why')

    await store.archiveActive(repo, 'arc-1', AT)
    // The composed operation archives whatever is active before promoting; here the
    // active slots are already empty, so the restore stands alone.
    await store.restore(repo, 'arc-1')

    expect(
      JSON.parse(readFileSync(projectPorcelainPath(repo, ACTIVE_FILES.review), 'utf8')),
    ).toMatchObject({ name: 'First' })
    expect(readFileSync(projectPorcelainPath(repo, ACTIVE_FILES.comments), 'utf8')).toContain(
      'look here',
    )
    expect(readFileSync(projectPorcelainPath(repo, ACTIVE_FILES.reviewed), 'utf8')).toContain(
      'fp-1',
    )
    expect(readFileSync(join(projectEvidenceDir(repo), 'index.html'), 'utf8')).toBe('<p>proof</p>')
    expect(readFileSync(join(projectIntentDir(repo), 'why.md'), 'utf8')).toBe('# Why')
    // Nothing lands at the pre-active-review flat paths any more.
    expect(existsSync(projectPorcelainPath(repo, 'comments.json'))).toBe(false)
    expect(existsSync(projectPorcelainPath(repo, 'evidence'))).toBe(false)
    expect(existsSync(projectArchivedReviewDir(repo, 'arc-1'))).toBe(false)
  })

  it('rejects a missing archive', async () => {
    await expect(store.restore(repo, 'nope')).rejects.toThrow('archived review not found: nope')
  })
})

describe('archive id containment', () => {
  it('refuses traversal and empty ids before touching the filesystem', async () => {
    writeArchiveMeta('kept', JSON.stringify({ id: 'kept', name: 'Kept', archivedAt: AT }))

    for (const id of ['../escape', 'nested/child', '']) {
      await expect(store.restore(repo, id)).rejects.toThrow('invalid review id')
      await expect(store.remove(repo, id)).rejects.toThrow('invalid review id')
    }

    expect(existsSync(projectArchivedReviewDir(repo, 'kept'))).toBe(true)
  })
})

describe('remove and archiveRelativePath', () => {
  it('deletes one archive and reports its repo-relative path', async () => {
    writeArchiveMeta('arc-1', JSON.stringify({ id: 'arc-1', name: 'Gone', archivedAt: AT }))

    expect(store.archiveRelativePath(repo, 'arc-1')).toBe(
      projectArchivedReviewDir(repo, 'arc-1').slice(repo.length + 1),
    )
    await store.remove(repo, 'arc-1')
    expect(existsSync(projectArchivedReviewDir(repo, 'arc-1'))).toBe(false)
    expect(await store.list(repo)).toEqual([])
  })
})

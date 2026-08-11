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
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  activeReviewCost,
  archiveActiveReview,
  clearReviewSet,
  isRepoContained,
  listArchivedReviews,
  readReviewSet,
  restoreArchivedReview,
} from './review-store'
import { markReviewed, readReviewedMarks } from './reviewed-store'

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

describe('clearReviewSet (archives)', () => {
  it('archives active review and clears the slot', async () => {
    writeReview({ name: 'A', files: [{ path: 'a.ts' }], sections: [] })
    await clearReviewSet(repo)
    expect(await readReviewSet(repo)).toBeNull()
    const archived = await listArchivedReviews(repo)
    expect(archived).toHaveLength(1)
    expect(archived[0]?.name).toBe('A')
  })

  it('is a no-op when nothing is active', async () => {
    await expect(clearReviewSet(repo)).resolves.toBeUndefined()
    expect(await listArchivedReviews(repo)).toEqual([])
  })
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

describe('restoreArchivedReview', () => {
  it('promotes an archive back to active', async () => {
    writeReview({ name: 'First', files: [{ path: 'a.ts' }], sections: [], thesis: 't1' })
    const id = await archiveActiveReview(repo)
    expect(id).toBeTruthy()
    expect(await readReviewSet(repo)).toBeNull()
    await restoreArchivedReview(repo, id as string)
    const set = await readReviewSet(repo)
    expect(set?.name).toBe('First')
    expect(await listArchivedReviews(repo)).toEqual([])
  })

  // Restore used to copy the archive back to the flat `.porcelain/*.json` paths
  // while every reader looks inside `active-review/` — a restored review came
  // back with its comments and marks nowhere anything would find them.
  it('lands every slot where the readers look', async () => {
    writeReview({ name: 'First', files: [{ path: 'a.ts' }], sections: [] })
    // Strict v1 comments document — archive/restore copy bytes; no dual-read of legacy arrays.
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.comments),
      `${JSON.stringify(
        {
          version: 1,
          comments: [
            {
              id: 'c1',
              path: 'a.ts',
              body: 'look here',
              resolved: false,
              createdAt: 1,
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await markReviewed(repo, 'a.ts', 'fingerprint-1')
    mkdirSync(projectEvidenceDir(repo), { recursive: true })
    writeFileSync(join(projectEvidenceDir(repo), 'index.html'), '<p>proof</p>')
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'why.md'), '# Why')

    const id = await archiveActiveReview(repo)
    await restoreArchivedReview(repo, id as string)

    const restoredComments = JSON.parse(
      readFileSync(projectPorcelainPath(repo, ACTIVE_FILES.comments), 'utf8'),
    ) as { version: number; comments: Array<{ body: string }> }
    expect(restoredComments.version).toBe(1)
    expect(restoredComments.comments.map((c) => c.body)).toEqual(['look here'])
    expect((await readReviewedMarks(repo)).map((m) => m.path)).toEqual(['a.ts'])
    expect(readFileSync(join(projectEvidenceDir(repo), 'index.html'), 'utf8')).toBe('<p>proof</p>')
    expect(readFileSync(join(projectIntentDir(repo), 'why.md'), 'utf8')).toBe('# Why')
    // Nothing lands at the pre-active-review flat paths any more.
    expect(existsSync(projectPorcelainPath(repo, 'comments.json'))).toBe(false)
    expect(existsSync(projectPorcelainPath(repo, 'evidence'))).toBe(false)
  })
})

describe('empty name is null', () => {
  it('treats empty review file as no set', async () => {
    writeReview({ name: '', files: [], sections: [] })
    expect(await readReviewSet(repo)).toBeNull()
  })
})

describe('intent travels with the review', () => {
  it('archives the intent directory and clears the active one', async () => {
    writeReview({ name: 'A', files: [], sections: [] })
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'index.md'), '# Why')

    const id = await archiveActiveReview(repo)
    expect(id).not.toBeNull()
    expect(
      readFileSync(join(projectArchivedReviewDir(repo, id ?? ''), 'intent', 'index.md'), 'utf8'),
    ).toBe('# Why')
    expect(existsSync(projectIntentDir(repo))).toBe(false)
  })

  it('archives intent even when there is no review file yet', async () => {
    mkdirSync(projectIntentDir(repo), { recursive: true })
    writeFileSync(join(projectIntentDir(repo), 'index.md'), 'draft')
    expect(await archiveActiveReview(repo)).not.toBeNull()
  })
})

describe('publish cost', () => {
  it('counts what would enter history, not just the review file', async () => {
    writeReview({ name: 'A', files: [], sections: [] })
    mkdirSync(join(projectEvidenceDir(repo), 'assets'), { recursive: true })
    writeFileSync(join(projectEvidenceDir(repo), 'index.html'), '<p>ok</p>')
    writeFileSync(join(projectEvidenceDir(repo), 'assets', 'shot.png'), 'x'.repeat(4096))

    const cost = await activeReviewCost(repo)
    expect(cost.files).toBe(3)
    expect(cost.bytes).toBeGreaterThan(4096)
  })

  it('is zero for an empty companion', async () => {
    expect(await activeReviewCost(repo)).toEqual({ bytes: 0, files: 0 })
  })
})

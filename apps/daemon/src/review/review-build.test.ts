import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_LAYERS } from '../features/project-data'
import { gitEnv } from '../git/git-env'
import { clearWorkingTreeSnapshot } from '../git/working-tree'
import {
  cachedReviewReading,
  gatherReview,
  getReviewBuild,
  type ReviewGather,
  readSourcesInto,
  storeReviewReading,
} from './review-build'
import type { ReviewSet } from './review-set'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
  GIT_AUTHOR_DATE: '2024-01-01T12:00:00Z',
  GIT_COMMITTER_DATE: '2024-01-01T12:00:00Z',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

const dirs: string[] = []

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  dirs.push(dir)
  return dir
}

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('readSourcesInto', () => {
  it('reads working-tree contents into the map', async () => {
    const dir = await tempDir('porcelain-review-read-')
    await writeFile(join(dir, 'a.ts'), 'export const a = 1\n')
    const sources = new Map<string, string>()

    await readSourcesInto(dir, ['a.ts'], sources)

    expect(sources.get('a.ts')).toBe('export const a = 1\n')
  })

  it('leaves an already-read path untouched', async () => {
    const dir = await tempDir('porcelain-review-reread-')
    await writeFile(join(dir, 'a.ts'), 'export const a = 1\n')
    const sources = new Map([['a.ts', 'already here']])

    await readSourcesInto(dir, ['a.ts'], sources)

    expect(sources.get('a.ts')).toBe('already here')
  })

  it('skips an unreadable path and a source at the 1MB cap', async () => {
    const dir = await tempDir('porcelain-review-skip-')
    await writeFile(join(dir, 'huge.ts'), 'x'.repeat(1024 * 1024))
    const sources = new Map<string, string>()

    await readSourcesInto(dir, ['gone.ts', 'huge.ts'], sources)

    expect(sources.size).toBe(0)
  })
})

describe('review build', () => {
  async function repo(prefix: string): Promise<string> {
    const dir = await tempDir(prefix)
    git(dir, 'init', '-b', 'main')
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(join(dir, 'src', 'a.ts'), 'export const a = 1\n')
    await writeFile(join(dir, 'src', 'b.ts'), "import { a } from './a'\nexport const b = a\n")
    git(dir, 'add', '-A')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'root')
    return dir
  }

  async function writeReviewSet(repoPath: string, set: ReviewSet): Promise<void> {
    await mkdir(projectActiveReviewDir(repoPath), { recursive: true })
    await writeFile(
      projectPorcelainPath(repoPath, ACTIVE_FILES.review),
      JSON.stringify(set, null, 2),
    )
  }

  const gathered = async (repoPath: string): Promise<ReviewGather> => {
    const g = await gatherReview(repoPath)
    if (!g.reviewSet) throw new Error('expected a review set')
    return { ...g, reviewSet: g.reviewSet }
  }

  it('gathers the starter layers and a null review set when nothing is configured', async () => {
    const dir = await repo('porcelain-review-bare-')
    const g = await gatherReview(dir)

    expect(g.reviewSet).toBeNull()
    expect(g.layers).toEqual(DEFAULT_LAYERS)
    expect(g.key).toBe((await gatherReview(dir)).key)
  })

  it('moves the key when the review set changes', async () => {
    const dir = await repo('porcelain-review-key-')
    await writeReviewSet(dir, { name: 'One', files: [{ path: 'src/a.ts' }], sections: [] })
    const first = await gatherReview(dir)

    await writeReviewSet(dir, { name: 'Two', files: [{ path: 'src/a.ts' }], sections: [] })
    expect((await gatherReview(dir)).key).not.toBe(first.key)
  })

  it('builds the view from the review set, tagging dirty files and merging stats', async () => {
    const dir = await repo('porcelain-active-review-')
    await writeFile(join(dir, 'src', 'b.ts'), "import { a } from './a'\nexport const b = a + 1\n")
    await writeReviewSet(dir, {
      name: 'Feature',
      files: [{ path: 'src/b.ts' }, { path: 'src/a.ts', source: 'context' }],
      sections: [],
    })

    const { view } = await getReviewBuild(dir, await gathered(dir))
    const files = view.groups.flatMap((group) => group.files)

    expect(view.name).toBe('Feature')
    // Agent order is verbatim; git tags the dirty file as `changed` and attaches stats.
    expect(files.map((file) => file.path)).toEqual(['src/b.ts', 'src/a.ts'])
    expect(files[0]).toMatchObject({ source: 'changed', additions: 1, deletions: 1 })
    expect(files[1]?.source).toBe('context')
  })

  it('memoizes the build on the gather key and busts when it moves', async () => {
    const dir = await repo('porcelain-review-memo-')
    await writeFile(join(dir, 'src', 'b.ts'), "import { a } from './a'\nexport const b = a + 1\n")
    await writeReviewSet(dir, { name: 'Feature', files: [{ path: 'src/b.ts' }], sections: [] })

    // First build may write companion snapshots under `.porcelain/` (e.g. active-review.json),
    // which changes git status. Settle once, then assert identity on a stable tree.
    await getReviewBuild(dir, await gathered(dir))
    clearWorkingTreeSnapshot(dir)
    const settled = await getReviewBuild(dir, await gathered(dir))
    clearWorkingTreeSnapshot(dir)
    expect(await getReviewBuild(dir, await gathered(dir))).toBe(settled)

    await writeReviewSet(dir, { name: 'Renamed', files: [{ path: 'src/b.ts' }], sections: [] })
    clearWorkingTreeSnapshot(dir)
    const second = await getReviewBuild(dir, await gathered(dir))
    expect(second).not.toBe(settled)
    expect(second.view.name).toBe('Renamed')
  })
})

describe('review reading cache', () => {
  const reading = { name: 'Review', sections: [], groups: [], evidence: null }

  it('serves a stored reading on the same key only', () => {
    expect(cachedReviewReading('/reading-repo', 'k1')).toBeNull()
    storeReviewReading('/reading-repo', 'k1', reading)
    expect(cachedReviewReading('/reading-repo', 'k1')).toBe(reading)
    expect(cachedReviewReading('/reading-repo', 'k2')).toBeNull()
  })

  it('keeps repos in separate entries', () => {
    storeReviewReading('/reading-a', 'k', reading)
    expect(cachedReviewReading('/reading-b', 'k')).toBeNull()
  })
})

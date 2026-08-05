import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ACTIVE_FILES,
  PROJECT_FILES,
  projectActiveReviewDir,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureProjectCompanion, resetProjectCompanionMemo } from './migrate-home'

const root = join(tmpdir(), 'porcelain-migrate-home-test')
const home = join(root, 'home')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
  mkdirSync(home, { recursive: true })
  process.env.PORCELAIN_HOME = home
  // The memo is per process, so each case starts as a repo this process has never seen.
  resetProjectCompanionMemo()
})
afterEach(() => {
  delete process.env.PORCELAIN_HOME
  rmSync(root, { recursive: true, force: true })
})

describe('ensureProjectCompanion', () => {
  it('is a no-op when the repo has no home data and no project dir', async () => {
    const result = await ensureProjectCompanion(repo)
    expect(result.migrated).toBe(false)
  })

  it('migrates home board + notes into .porcelain and purges home keys', async () => {
    writeFileSync(
      join(home, 'board.json'),
      JSON.stringify({
        [repo]: [{ id: 'c1', title: 'Ship', status: 'todo', order: 1, createdAt: 1 }],
      }),
    )
    writeFileSync(join(home, 'notes.json'), JSON.stringify({ [repo]: '# hello' }))

    const result = await ensureProjectCompanion(repo)
    expect(result.migrated).toBe(true)

    const board = JSON.parse(
      readFileSync(projectPorcelainPath(repo, PROJECT_FILES.board), 'utf8'),
    ) as unknown[]
    expect(board).toHaveLength(1)
    expect(readFileSync(projectPorcelainPath(repo, PROJECT_FILES.notes), 'utf8')).toBe('# hello')
    expect(readFileSync(projectPorcelainPath(repo, PROJECT_FILES.gitignore), 'utf8')).toContain(
      'evidence/',
    )

    // Home keys purged (file may be empty/deleted).
    try {
      const homeBoard = JSON.parse(readFileSync(join(home, 'board.json'), 'utf8')) as Record<
        string,
        unknown
      >
      expect(homeBoard[repo]).toBeUndefined()
    } catch {
      // file removed entirely when empty — ok
    }

    // Second call is memoized: it reports what the one run for this repo concluded
    // rather than re-walking home. `migrated` answers "did this repo migrate",
    // not "did this particular call do work".
    expect((await ensureProjectCompanion(repo)).migrated).toBe(true)
    expect(projectPorcelainDir(repo)).toBe(join(repo, '.porcelain'))
  })

  it('stores scope paths as repo-relative', async () => {
    writeFileSync(
      join(home, 'scope.json'),
      JSON.stringify({
        [repo]: {
          hiddenPaths: [`${repo}/apps/legacy`],
          pinnedPaths: [`${repo}/apps/web`],
        },
      }),
    )
    await ensureProjectCompanion(repo)
    const scope = JSON.parse(
      readFileSync(projectPorcelainPath(repo, PROJECT_FILES.scope), 'utf8'),
    ) as { hiddenPaths: string[]; pinnedPaths: string[] }
    expect(scope.hiddenPaths).toEqual(['apps/legacy'])
    expect(scope.pinnedPaths).toEqual(['apps/web'])
  })

  it('fills missing channels when .porcelain already exists (empty shell)', async () => {
    mkdirSync(projectActiveReviewDir(repo), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, ACTIVE_FILES.review),
      JSON.stringify({ name: 'in-repo' }),
    )
    writeFileSync(
      join(home, 'board.json'),
      JSON.stringify({
        [repo]: [{ id: 'c1', title: 'From home', status: 'todo', order: 1, createdAt: 1 }],
      }),
    )
    writeFileSync(join(home, 'review-sets.json'), JSON.stringify({ [repo]: { name: 'from-home' } }))

    const result = await ensureProjectCompanion(repo)
    expect(result.migrated).toBe(true)

    const board = JSON.parse(
      readFileSync(projectPorcelainPath(repo, PROJECT_FILES.board), 'utf8'),
    ) as Array<{ title: string }>
    expect(board).toEqual([expect.objectContaining({ title: 'From home' })])
    // Existing in-repo review is not clobbered by home.
    expect(
      JSON.parse(readFileSync(projectPorcelainPath(repo, ACTIVE_FILES.review), 'utf8')),
    ).toEqual({ name: 'in-repo' })
  })
})

describe('migration memo', () => {
  it('runs once per repo per process', async () => {
    writeFileSync(join(home, 'notes.json'), JSON.stringify({ [repo]: '# hello' }))
    expect((await ensureProjectCompanion(repo)).migrated).toBe(true)

    // A second call must not re-read home or re-land anything: home is purged, so
    // an unmemoized pass would report false and churn the disk on every store read.
    writeFileSync(join(home, 'notes.json'), JSON.stringify({ [repo]: '# resurrected' }))
    expect((await ensureProjectCompanion(repo)).migrated).toBe(true)
    expect(readFileSync(projectPorcelainPath(repo, PROJECT_FILES.notes), 'utf8')).toBe('# hello')
  })

  it('shares one run between concurrent first callers', async () => {
    writeFileSync(join(home, 'board.json'), JSON.stringify({ [repo]: [] }))
    const [a, b] = await Promise.all([ensureProjectCompanion(repo), ensureProjectCompanion(repo)])
    expect(a).toBe(b)
  })
})

import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isRepoContained, readReviewSet, reviewLayersForRepo } from './review-store'

const root = join(tmpdir(), 'porcelain-review-store-test')
const repo = join(root, 'repo')
const home = join(root, 'home')
const previousHome = process.env.PORCELAIN_HOME

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
  process.env.PORCELAIN_HOME = home
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = previousHome
})

describe('isRepoContained', () => {
  it('accepts repo-relative paths and rejects escapes', () => {
    expect(isRepoContained('/repo', 'src/a.ts')).toBe(true)
    expect(isRepoContained('/repo', '../../../etc/passwd')).toBe(false)
    expect(isRepoContained('/repo', '/etc/passwd')).toBe(false)
  })
})

it('reads only Review metadata from the daemon-root Canvas', async () => {
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repo })
  const commonGitDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repo,
    encoding: 'utf8',
  }).trim()
  mkdirSync(home, { recursive: true })
  writeFileSync(
    join(home, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'project-1',
            commonGitDir: realpathSync(resolve(repo, commonGitDir)),
            worktrees: [{ id: 'worktree-1', gitDir: realpathSync(resolve(repo, '.git')) }],
          },
        ],
      },
    }),
  )
  const bundle = canvasBundleDir(home, 'project-1', 'review-1')
  mkdirSync(bundle, { recursive: true })
  const otherBundle = canvasBundleDir(home, 'project-1', 'review-other')
  mkdirSync(otherBundle, { recursive: true })
  writeFileSync(
    canvasIndexPath(home, 'project-1'),
    JSON.stringify({
      version: 1,
      value: {
        canvases: [
          {
            id: 'review-1',
            worktreeId: 'worktree-1',
            title: 'Canvas review',
            kind: 'markdown',
            entryFile: 'index.md',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            template: 'review',
          },
          {
            id: 'review-other',
            worktreeId: 'worktree-other',
            title: 'Other worktree review',
            kind: 'markdown',
            entryFile: 'index.md',
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            template: 'review',
          },
        ],
      },
    }),
  )
  writeFileSync(
    join(bundle, 'review.json'),
    JSON.stringify({
      name: 'Canvas review',
      layers: [{ label: 'Source', pattern: '^src/' }],
      files: [{ path: 'src/a.ts' }],
      sections: [],
    }),
  )
  writeFileSync(
    join(otherBundle, 'review.json'),
    JSON.stringify({
      name: 'Other worktree review',
      layers: [{ label: 'Other', pattern: '.*' }],
      files: [],
      sections: [],
    }),
  )
  await expect(readReviewSet(repo)).resolves.toMatchObject({ name: 'Canvas review' })
  await expect(reviewLayersForRepo(repo)).resolves.toEqual([{ label: 'Source', pattern: '^src/' }])
})

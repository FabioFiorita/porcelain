import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import {
  ACTIVE_FILES,
  projectActiveReviewDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isRepoContained, readReviewSet } from './review-store'

const root = join(tmpdir(), 'porcelain-review-store-test')
const repo = join(root, 'repo')
const home = join(root, 'home')
const previousHome = process.env.PORCELAIN_HOME

function writeReview(data: unknown): void {
  mkdirSync(projectActiveReviewDir(repo), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, ACTIVE_FILES.review), JSON.stringify(data))
}

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

describe('retired canvas field', () => {
  it('ignores an on-disk canvas of any medium instead of failing the whole review', async () => {
    for (const canvas of [
      { medium: 'html', html: '<p>board</p>' },
      { medium: 'excalidraw', scene: { elements: [] } },
    ]) {
      writeReview({ name: 'test', files: [{ path: 'a.ts' }], sections: [], canvas })
      const set = await readReviewSet(repo)
      expect(set?.name).toBe('test')
      expect(set?.files.map((file) => file.path)).toEqual(['a.ts'])
      expect(set).not.toHaveProperty('canvas')
    }
  })
})

describe('empty name is null', () => {
  it('treats empty review file as no set', async () => {
    writeReview({ name: '', files: [], sections: [] })
    expect(await readReviewSet(repo)).toBeNull()
  })
})

describe('daemon-root Review Canvas', () => {
  it('reads Review metadata written by the CLI Canvas boundary', async () => {
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
              worktrees: [],
            },
          ],
        },
      }),
    )
    const bundle = canvasBundleDir(home, 'project-1', 'review-1')
    mkdirSync(bundle, { recursive: true })
    writeFileSync(
      canvasIndexPath(home, 'project-1'),
      JSON.stringify({
        version: 1,
        value: {
          canvases: [
            {
              id: 'review-1',
              worktreeId: null,
              title: 'Canvas review',
              kind: 'markdown',
              entryFile: 'index.md',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              template: 'review',
            },
          ],
        },
      }),
    )
    writeFileSync(
      join(bundle, 'review.json'),
      JSON.stringify({ name: 'Canvas review', files: [{ path: 'src/a.ts' }], sections: [] }),
    )

    await expect(readReviewSet(repo)).resolves.toMatchObject({
      name: 'Canvas review',
      files: [{ path: 'src/a.ts' }],
    })
  })
})

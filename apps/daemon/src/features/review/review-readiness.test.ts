import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { canvasBundleDir, canvasIndexPath } from '@shared/canvas-porcelain'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { workingTreeFingerprint } from '../../git/git-fingerprints'
import { readReviewReadiness } from './review-readiness'

const root = join(tmpdir(), 'porcelain-review-readiness-test')
const repo = join(root, 'repo')
const home = join(root, 'home')
const previousHome = process.env.PORCELAIN_HOME

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function writeCanvas(metadata: Record<string, unknown>, document?: string): void {
  const bundle = canvasBundleDir(home, 'project-1', 'review-1')
  mkdirSync(bundle, { recursive: true })
  writeFileSync(join(bundle, 'review.json'), JSON.stringify(metadata))
  writeFileSync(
    join(bundle, 'canvas.json'),
    document ??
      JSON.stringify({
        version: 2,
        template: 'review',
        title: 'Review',
        sections: [{ title: 'Why', prose: 'Proof', references: [] }],
        evidence: {
          title: 'Evidence',
          checks: [
            { label: 'pass', status: 'pass' },
            { label: 'skip', status: 'skip' },
          ],
          assets: [{ kind: 'image', path: 'proof.png', label: 'Proof' }],
        },
      }),
  )
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
  process.env.PORCELAIN_HOME = home
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'user.name', 'Test')
  writeFileSync(join(repo, 'a.ts'), 'one\n')
  git('add', 'a.ts')
  git('commit', '-m', 'base')
  const gitDir = git('rev-parse', '--git-dir')
  mkdirSync(home, { recursive: true })
  writeFileSync(
    join(home, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'project-1',
            commonGitDir: realpathSync(resolve(repo, git('rev-parse', '--git-common-dir'))),
            worktrees: [{ id: 'worktree-1', gitDir: realpathSync(resolve(repo, gitDir)) }],
          },
        ],
      },
    }),
  )
  const indexPath = canvasIndexPath(home, 'project-1')
  mkdirSync(dirname(indexPath), { recursive: true })
  writeFileSync(
    indexPath,
    JSON.stringify({
      version: 1,
      value: {
        canvases: [
          {
            id: 'review-1',
            worktreeId: 'worktree-1',
            template: 'review',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    }),
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = previousHome
})

it('returns real Canvas evidence and becomes stale after a same-file edit or HEAD advance', async () => {
  writeFileSync(join(repo, 'a.ts'), 'two\n')
  const fingerprint = await workingTreeFingerprint(repo)
  writeCanvas({
    name: 'Review',
    workingFingerprint: fingerprint,
    layers: [],
    files: [{ path: 'a.ts' }, { path: 'a.ts' }, { path: 'context.ts' }],
    sections: [],
  })

  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'working' } }),
  ).resolves.toMatchObject({
    freshness: 'current',
    binding: 'live',
    canvas: { id: 'review-1' },
    coverage: { changedFileCount: 1, orderedFileCount: 1, missingCount: 0 },
    evidence: { checks: 2, passed: 1, failed: 0, skipped: 1, assets: 1 },
  })

  writeFileSync(join(repo, 'a.ts'), 'three\n')
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'working' } }),
  ).resolves.toMatchObject({
    freshness: 'stale',
    binding: 'live',
  })

  git('add', 'a.ts')
  git('commit', '-m', 'advance')
  const head = git('rev-parse', 'HEAD')
  const cleanFingerprint = await workingTreeFingerprint(repo)
  writeCanvas({
    name: 'Review',
    commitHash: head,
    workingFingerprint: cleanFingerprint,
    layers: [],
    files: [{ path: 'a.ts' }],
    sections: [],
  })
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'working' } }),
  ).resolves.toMatchObject({
    freshness: 'current',
    binding: 'commit',
  })
  writeFileSync(join(repo, 'a.ts'), 'four\n')
  git('add', 'a.ts')
  git('commit', '-m', 'advance again')
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'working' } }),
  ).resolves.toMatchObject({
    freshness: 'stale',
    binding: 'commit',
  })
})

it('uses resolved commits for commit/range readiness and exposes an unreadable selected Review', async () => {
  git('checkout', '-b', 'feature')
  writeFileSync(join(repo, 'a.ts'), 'two\n')
  git('add', 'a.ts')
  git('commit', '-m', 'feature')
  const head = git('rev-parse', 'HEAD')
  writeCanvas({
    name: 'Review',
    commitHash: head,
    workingFingerprint: await workingTreeFingerprint(repo),
    layers: [],
    files: [{ path: 'a.ts' }],
    sections: [],
  })
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'commit', hash: head.slice(0, 12) } }),
  ).resolves.toMatchObject({ freshness: 'current', binding: 'commit', canvas: { id: 'review-1' } })
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'range', base: 'main' } }),
  ).resolves.toMatchObject({
    freshness: 'current',
    binding: 'commit',
    coverage: { changedFileCount: 1, orderedFileCount: 1 },
  })

  writeCanvas({}, '{not json')
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'working' } }),
  ).resolves.toMatchObject({
    freshness: 'unavailable',
    binding: 'none',
    canvas: { id: 'review-1' },
    issue: 'unavailable',
  })
})

it('resolves the default base when range readiness omits one', async () => {
  git('checkout', '-b', 'feature')
  writeFileSync(join(repo, 'a.ts'), 'two\n')
  git('add', 'a.ts')
  git('commit', '-m', 'feature')
  const head = git('rev-parse', 'HEAD')
  writeCanvas({
    name: 'Review',
    commitHash: head,
    workingFingerprint: await workingTreeFingerprint(repo),
    layers: [],
    files: [{ path: 'a.ts' }],
    sections: [],
  })
  await expect(
    readReviewReadiness({ repoPath: repo, scope: { type: 'range' } }),
  ).resolves.toMatchObject({
    freshness: 'current',
    coverage: { changedFileCount: 1, orderedFileCount: 1 },
  })
})

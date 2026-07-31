import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { gitEnv } from './git-env'
import { isLinkedWorktree, primaryCheckoutPath } from './linked-worktree'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    // gitEnv, not a bare process.env: an inherited GIT_DIR would override `cwd`
    // and point every fixture command at the real repository.
    env: gitEnv(process.env, GIT_ENV),
    cwd,
    stdio: 'pipe',
  }).toString()
}

const dirs: string[] = []

async function repoWithWorktree(): Promise<{ primary: string; worktree: string }> {
  const primary = await mkdtemp(join(tmpdir(), 'porcelain-linked-'))
  const worktree = join(dirname(primary), `${basename(primary)}-worktrees`, 'feature')
  dirs.push(primary, dirname(worktree))
  git(primary, 'init', '-b', 'main')
  git(primary, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
  git(primary, 'worktree', 'add', '-b', 'feature', worktree)
  return { primary, worktree }
}

afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

describe('isLinkedWorktree', () => {
  it('is true for a linked worktree and false for its primary checkout', async () => {
    const { primary, worktree } = await repoWithWorktree()
    expect(await isLinkedWorktree(worktree)).toBe(true)
    expect(await isLinkedWorktree(primary)).toBe(false)
  })

  it('is false for a plain directory and for a path that does not exist', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'porcelain-plain-'))
    dirs.push(plain)
    await writeFile(join(plain, 'readme.md'), '# hi\n')
    expect(await isLinkedWorktree(plain)).toBe(false)
    expect(await isLinkedWorktree(join(plain, 'nope'))).toBe(false)
  })
})

describe('primaryCheckoutPath', () => {
  it('resolves a linked worktree back to its primary checkout', async () => {
    const { primary, worktree } = await repoWithWorktree()
    // git realpath-resolves its administrative paths (macOS /var → /private/var),
    // so compare on the leaf rather than the whole prefix.
    expect(basename((await primaryCheckoutPath(worktree)) ?? '')).toBe(basename(primary))
  })

  it('returns null for a primary checkout and for a non-repo path', async () => {
    const { primary } = await repoWithWorktree()
    expect(await primaryCheckoutPath(primary)).toBeNull()
    expect(await primaryCheckoutPath(join(tmpdir(), 'porcelain-no-such-dir'))).toBeNull()
  })
})

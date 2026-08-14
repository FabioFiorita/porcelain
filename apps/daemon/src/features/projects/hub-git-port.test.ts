// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitEnv } from '../../git/git-env'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createHubGitPort } from './hub-git-port'

const TEST_GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, TEST_GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

async function makeRepo(root: string, name = 'alpha'): Promise<string> {
  const repo = join(root, name)
  await mkdir(repo)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.name', 'Test User')
  git(repo, 'config', 'user.email', 'test@porcelain.test')
  git(repo, 'remote', 'add', 'origin', 'git@github.com:acme/alpha.git')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
  return repo
}

describe('Hub git discovery', () => {
  it('discovers a Project family and every live Worktree without using the path as identity', async () => {
    await withTemporaryDirectory('porcelain-hub-git-', async (root) => {
      const repo = await makeRepo(root)
      const worktree = join(root, 'alpha-worktrees', 'topic')
      await mkdir(join(root, 'alpha-worktrees'))
      git(repo, 'worktree', 'add', '-b', 'topic', worktree)

      const port = createHubGitPort({
        addWorktree: async () => ({
          ok: true,
          value: { path: worktree, branch: 'topic' },
        }),
      })
      const discovered = await port.discoverProject(worktree)
      expect(discovered.ok).toBe(true)
      if (!discovered.ok) return
      expect(discovered.value.name).toBe('alpha')
      expect(discovered.value.groupingKey).toBe('ssh://git@github.com/acme/alpha')
      expect(discovered.value.worktrees).toHaveLength(2)
      expect(discovered.value.worktrees.some((worktree) => worktree.isPrimary)).toBe(true)
      expect(
        discovered.value.worktrees
          .map((worktree) => worktree.gitDir)
          .every((gitDir) => gitDir !== ''),
      ).toBe(true)
      expect(new Set(discovered.value.worktrees.map((worktree) => worktree.gitDir)).size).toBe(2)
    })
  })

  it('rejects a non-repository directory', async () => {
    await withTemporaryDirectory('porcelain-hub-git-plain-', async (root) => {
      const plain = join(root, 'plain')
      await mkdir(plain)
      await writeFile(join(plain, 'readme.md'), 'hi\n')
      const port = createHubGitPort({
        addWorktree: async () => ({
          ok: true,
          value: { path: plain, branch: 'unused' },
        }),
      })
      expect(await port.discoverProject(plain)).toEqual({ ok: false, error: 'not-a-repository' })
    })
  })
})

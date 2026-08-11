// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitEnv } from '../../git/git-env'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createGitSubprocess, type GitExecute, type GitExecuteOptions } from './git-subprocess'

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

async function makeRepo(root: string): Promise<string> {
  const repo = join(root, 'repo')
  await mkdir(repo)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.name', 'Test User')
  git(repo, 'config', 'user.email', 'test@porcelain.test')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
  await writeFile(join(repo, 'tracked.ts'), 'export const value = 1\n')
  git(repo, 'add', 'tracked.ts')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '-m', 'add tracked')
  return repo
}

describe('Git subprocess adapter', () => {
  it('checks out a branch and returns a void success value', async () => {
    await withTemporaryDirectory('porcelain-git-subprocess-', async (root) => {
      const repo = await makeRepo(root)
      git(repo, 'branch', 'feature')

      await expect(createGitSubprocess().checkout(repo, 'feature')).resolves.toEqual({
        ok: true,
        value: undefined,
      })
      expect(git(repo, 'branch', '--show-current').trim()).toBe('feature')
    })
  })

  it('normalizes repository and missing-branch checkout failures', async () => {
    await withTemporaryDirectory('porcelain-git-subprocess-', async (root) => {
      const repo = await makeRepo(root)
      const adapter = createGitSubprocess()
      await mkdir(join(root, 'not-a-repository'))

      await expect(adapter.checkout(join(root, 'not-a-repository'), 'main')).resolves.toEqual({
        ok: false,
        error: { code: 'git.not-a-repository' },
      })
      await expect(adapter.checkout(repo, 'missing')).resolves.toEqual({
        ok: false,
        error: { code: 'git.branch-not-found' },
      })
    })
  })

  it('normalizes a dirty-tree checkout refusal without exposing Git output', async () => {
    await withTemporaryDirectory('porcelain-git-subprocess-', async (root) => {
      const repo = await makeRepo(root)
      git(repo, 'checkout', '-b', 'feature')
      await writeFile(join(repo, 'tracked.ts'), 'export const value = 2\n')
      git(repo, 'add', 'tracked.ts')
      git(repo, '-c', 'commit.gpgsign=false', 'commit', '-m', 'feature change')
      git(repo, 'checkout', 'main')
      await writeFile(join(repo, 'tracked.ts'), 'export const value = 3\n')

      await expect(createGitSubprocess().checkout(repo, 'feature')).resolves.toEqual({
        ok: false,
        error: { code: 'git.working-tree-conflict' },
      })
      expect(git(repo, 'branch', '--show-current').trim()).toBe('main')
    })
  })

  it('creates a sanitized sibling worktree and preserves the real branch name', async () => {
    await withTemporaryDirectory('porcelain-git-subprocess-', async (root) => {
      const repo = await makeRepo(root)
      const result = await createGitSubprocess().addWorktree(repo, 'feature/x')

      expect(result).toEqual({
        ok: true,
        value: {
          path: join(dirname(repo), `${basename(repo)}-worktrees`, 'feature-x'),
          branch: 'feature/x',
        },
      })
      if (result.ok) {
        expect(git(repo, 'worktree', 'list', '--porcelain')).toContain(
          `branch refs/heads/${result.value.branch}`,
        )
      }
    })
  })

  it('normalizes existing branches and worktree path/branch conflicts', async () => {
    await withTemporaryDirectory('porcelain-git-subprocess-', async (root) => {
      const repo = await makeRepo(root)
      const adapter = createGitSubprocess()
      git(repo, 'branch', 'existing')

      await expect(adapter.addWorktree(repo, 'existing')).resolves.toEqual({
        ok: false,
        error: { code: 'git.branch-already-exists' },
      })

      const destination = join(dirname(repo), `${basename(repo)}-worktrees`, 'collision')
      await mkdir(destination, { recursive: true })
      await writeFile(join(destination, 'existing.txt'), 'occupied\n')
      await expect(adapter.addWorktree(repo, 'collision')).resolves.toEqual({
        ok: false,
        error: { code: 'git.worktree-conflict' },
      })
    })
  })

  it('pins argv, cwd, environment scrubbing, maxBuffer, and realpath at the adapter boundary', async () => {
    const calls: Array<{ args: readonly string[]; options: GitExecuteOptions }> = []
    const execute: GitExecute = async (args, options) => {
      calls.push({ args, options })
      return ''
    }
    const adapter = createGitSubprocess({
      execute,
      mkdir: async () => undefined,
      realpath: async () => '/resolved/worktree',
      sourceEnv: {
        HOME: '/home/test',
        PATH: '/bin',
        GIT_DIR: '/wrong/repository',
        GIT_INDEX_FILE: '/wrong/index',
        GIT_OPTIONAL_LOCKS: '1',
      },
    })

    await expect(adapter.checkout('/synthetic/repo', 'main')).resolves.toEqual({
      ok: true,
      value: undefined,
    })
    await expect(adapter.addWorktree('/synthetic/repo', 'feature/x')).resolves.toEqual({
      ok: true,
      value: { path: '/resolved/worktree', branch: 'feature/x' },
    })

    expect(calls[0]).toMatchObject({
      args: ['checkout', 'main'],
      options: {
        cwd: '/synthetic/repo',
        maxBuffer: 64 * 1024 * 1024,
      },
    })
    expect(calls[1]).toMatchObject({
      args: ['worktree', 'add', '-b', 'feature/x', '/synthetic/repo-worktrees/feature-x'],
    })
    expect(calls[0]?.options.env).toMatchObject({
      HOME: '/home/test',
      PATH: '/bin',
      GIT_OPTIONAL_LOCKS: '0',
    })
    expect(calls[0]?.options.env.GIT_DIR).toBeUndefined()
    expect(calls[0]?.options.env.GIT_INDEX_FILE).toBeUndefined()
  })

  it('rethrows an unmatched native error unchanged', async () => {
    const unknown = new Error('opaque native failure')
    const execute: GitExecute = async () => {
      throw unknown
    }
    const adapter = createGitSubprocess({ execute })

    await expect(adapter.checkout('/synthetic/repo', 'main')).rejects.toBe(unknown)
  })
})

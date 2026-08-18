// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitQuickCommandInput } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'
import { gitEnv } from '../../git/git-env'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import {
  createCommitGeneration,
  createGitChangesPublisher,
  createGitDiffReadingSources,
  createProjectGit,
  isNotARepository,
  nativeOutput,
  repositoryRead,
} from './git-adapters'

const GIT_ENV = {
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_AUTHOR_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
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
  return repo
}

describe('ProjectGit adapter', () => {
  it('preserves fixed Git helpers through the project capability', async () => {
    await withTemporaryDirectory('porcelain-git-project-', async (root) => {
      const repo = await makeRepo(root)
      const projectGit = createProjectGit()
      const input: GitQuickCommandInput = { repoPath: repo, command: 'status' }

      await writeFile(join(repo, 'tracked.ts'), 'export const value = 1\n')
      await projectGit.stageAll(repo)
      await projectGit.commit(repo, 'add tracked')
      // Git status prose follows the host's locale; the branch name is the stable contract.
      expect(await projectGit.quickCommand(input)).toContain('main')
      expect(await projectGit.head(repo)).toEqual({
        branch: 'main',
        detachedSha: null,
        upstream: null,
      })

      git(repo, 'branch', 'feature')
      const branches = await projectGit.branches(repo)
      expect(branches.ok).toBe(true)
      if (branches.ok) expect(branches.value.map((branch) => branch.name)).toContain('feature')

      const worktrees = await projectGit.worktrees(repo)
      expect(worktrees.ok).toBe(true)
      if (worktrees.ok) expect(worktrees.value[0]?.path).toBe(repo)

      const status = await projectGit.status(repo)
      expect(status).toEqual({
        ok: true,
        value: [],
      })
    })
  })

  it('normalizes repository discovery failures without exposing native output', async () => {
    await withTemporaryDirectory('porcelain-git-project-', async (root) => {
      const notRepo = join(root, 'not-a-repository')
      await mkdir(notRepo)
      const projectGit = createProjectGit()

      await expect(projectGit.status(notRepo)).resolves.toEqual({
        ok: false,
        error: { code: 'git.not-a-repository' },
      })
      await expect(projectGit.branches(notRepo)).resolves.toEqual({
        ok: false,
        error: { code: 'git.not-a-repository' },
      })
      await expect(projectGit.worktrees(notRepo)).resolves.toEqual({
        ok: false,
        error: { code: 'git.not-a-repository' },
      })
    })
  })

  it('maps a working-tree change through the typed session fact', () => {
    const changes: unknown[] = []
    const publisher = createGitChangesPublisher((change) => changes.push(change))

    publisher.publishWorkingTreeChanged('/synthetic/repo')

    expect(changes).toEqual([{ kind: 'git.working-tree-changed', projectPath: '/synthetic/repo' }])
  })
})

describe('CommitGeneration and GitDiffReadingSources adapters', () => {
  it('lists commit models through the commit-generation capability', async () => {
    const generation = createCommitGeneration()
    expect(Object.isFrozen(generation)).toBe(true)

    const models = await generation.listModels()
    expect(Array.isArray(models)).toBe(true)
    for (const model of models) {
      expect(model).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(String),
          provider: expect.stringMatching(/^(claude|codex|grok|opencode)$/),
        }),
      )
    }
  })

  it('binds flow loaders and Git hunk helpers on the diff-reading capability', async () => {
    const sources = createGitDiffReadingSources()
    expect(Object.isFrozen(sources)).toBe(true)
    expect(typeof sources.loadWorkingFlow).toBe('function')
    expect(typeof sources.loadRangeFlow).toBe('function')
    expect(typeof sources.loadCommitFlow).toBe('function')
    expect(typeof sources.workingHunks).toBe('function')
    expect(typeof sources.rangeHunks).toBe('function')
    expect(typeof sources.commitHunks).toBe('function')
    expect(typeof sources.commitMessage).toBe('function')

    await withTemporaryDirectory('porcelain-git-diff-sources-', async (root) => {
      const repo = await makeRepo(root)
      await writeFile(join(repo, 'tracked.ts'), 'export const value = 2\n')
      const groups = await sources.loadWorkingFlow(repo)
      expect(groups.some((group) => group.files.some((file) => file.path === 'tracked.ts'))).toBe(
        true,
      )
      const hunks = await sources.workingHunks(repo, 'tracked.ts')
      expect(Array.isArray(hunks)).toBe(true)
      const message = await sources.commitMessage(repo, 'HEAD')
      expect(message).toContain('root')
    })
  })

  it('orders a changeset by the layers the profile declares for that checkout', async () => {
    await withTemporaryDirectory('porcelain-git-diff-layers-', async (root) => {
      const repo = await makeRepo(root)
      await mkdir(join(repo, 'src'), { recursive: true })
      await writeFile(join(repo, 'src', 'checkout.ts'), 'export const value = 2\n')

      const declared = await createGitDiffReadingSources({
        scope: { layersForRepo: async () => [{ label: 'Checkout', pattern: 'checkout' }] },
      }).loadWorkingFlow(repo)
      expect(declared.map((group) => group.layer)).toContain('Checkout')

      // Same repo, nothing declared: the starters group it, and 'Checkout'
      // cannot appear — proving the label came from the profile, not the path.
      const starters = await createGitDiffReadingSources({
        scope: { layersForRepo: async () => [] },
      }).loadWorkingFlow(repo)
      expect(starters.map((group) => group.layer)).not.toContain('Checkout')
    })
  })
})

/**
 * These two decide whether a thrown Git failure becomes `git.not-a-repository` or is rethrown to
 * the caller. Mutation testing found every branch unproven: the whole object guard could be
 * replaced with `if (false)` and the suite stayed green. Misclassifying here either swallows a
 * real Git error or reports a healthy repo as missing.
 */
describe('nativeOutput', () => {
  it('prefers the process streams over the error object itself', () => {
    expect(nativeOutput({ stderr: 'fatal: bad thing\n' })).toBe('fatal: bad thing\n')
    expect(nativeOutput({ stdout: 'on branch main' })).toBe('on branch main')
  })

  it('joins stderr before stdout when Git wrote both', () => {
    expect(nativeOutput({ stderr: 'err', stdout: 'out' })).toBe('err\nout')
  })

  it('ignores stream properties that are not strings', () => {
    expect(nativeOutput({ stderr: Buffer.from('bytes') })).toBe('[object Object]')
    expect(nativeOutput({ stdout: 7 })).toBe('[object Object]')
  })

  it('falls back to stringifying anything without usable streams', () => {
    expect(nativeOutput('plain failure')).toBe('plain failure')
    expect(nativeOutput(null)).toBe('null')
    expect(nativeOutput(undefined)).toBe('undefined')
    expect(nativeOutput(new Error('boom'))).toBe('Error: boom')
    expect(nativeOutput({})).toBe('[object Object]')
  })

  it('treats an empty stream as no output rather than an empty answer', () => {
    // `parts.length > 0` is the guard: an empty string is pushed, so the join wins over String().
    expect(nativeOutput({ stderr: '' })).toBe('')
  })
})

describe('isNotARepository', () => {
  it('recognises the Git message wherever it appears and whatever its case', () => {
    expect(isNotARepository({ stderr: 'fatal: not a git repository (or any parent)' })).toBe(true)
    expect(isNotARepository({ stderr: 'FATAL: NOT A GIT REPOSITORY' })).toBe(true)
    expect(isNotARepository('not a git repository')).toBe(true)
  })

  it('does not claim unrelated Git failures', () => {
    expect(isNotARepository({ stderr: 'fatal: your branch is behind' })).toBe(false)
    expect(isNotARepository(new Error('EACCES: permission denied'))).toBe(false)
    expect(isNotARepository(null)).toBe(false)
  })
})

describe('repositoryRead', () => {
  it('passes a successful read straight through', async () => {
    await expect(repositoryRead(async () => 'value')).resolves.toEqual({ ok: true, value: 'value' })
  })

  it('converts only the missing-repository failure into a typed result', async () => {
    await expect(
      repositoryRead(async () => {
        throw { stderr: 'fatal: not a git repository' }
      }),
    ).resolves.toEqual({ ok: false, error: { code: 'git.not-a-repository' } })
  })

  it('rethrows every other failure instead of mislabelling it', async () => {
    // The guard that makes this pass is `if (!isNotARepository(error)) throw error`. Drop it and
    // a permission error reports as a missing repository — a wrong diagnosis, not a lost one.
    const denied = new Error('EACCES: permission denied')
    await expect(
      repositoryRead(async () => {
        throw denied
      }),
    ).rejects.toBe(denied)
  })
})

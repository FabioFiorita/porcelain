// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { GitQuickCommandInput } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'
import { gitEnv } from '../../git/git-env'
import * as flowBuild from '../../review/flow-build'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import {
  createCommitGeneration,
  createGitChangesPublisher,
  createGitDiffReadingSources,
  createProjectGit,
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
      expect(await projectGit.quickCommand(input)).toContain('On branch main')
      expect(await projectGit.head(repo)).toEqual({ branch: 'main', detachedSha: null })

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
    expect(sources.loadWorkingFlow).toBe(flowBuild.loadWorkingFlow)
    expect(sources.loadRangeFlow).toBe(flowBuild.loadRangeFlow)
    expect(sources.loadCommitFlow).toBe(flowBuild.loadCommitFlow)
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
})

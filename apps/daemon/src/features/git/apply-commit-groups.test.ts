// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { gitEnv } from '../../git/git-env'
import { createProjectGit } from './git-adapters'
import { createGitOperations } from './git-operations'
import type {
  CommitGeneration,
  GitChanges,
  GitDiffReadingSources,
  GitWorkspacePort,
  WorkingTreeCache,
  WorkspaceTrash,
} from './git-ports'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

const repos: string[] = []

/**
 * A real repository with six tracked files, all modified in the working tree — the shape the
 * grouped-commit proposal is generated from. Real Git is the point of this suite: the promise
 * being proved is "exactly these paths land in this commit", which only Git can answer.
 */
async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'porcelain-groups-'))
  repos.push(dir)
  git(dir, 'init', '-b', 'main')
  git(dir, 'config', 'user.name', 'Test User')
  git(dir, 'config', 'user.email', 'test@porcelain.test')
  git(dir, 'config', 'commit.gpgsign', 'false')
  for (const path of ['a1.ts', 'a2.ts', 'b1.ts', 'b2.ts', 'c1.ts', 'c2.ts']) {
    await writeFile(join(dir, path), 'export const v = 1\n')
  }
  git(dir, 'add', '-A')
  git(dir, 'commit', '-m', 'root')
  for (const path of ['a1.ts', 'a2.ts', 'b1.ts', 'b2.ts', 'c1.ts', 'c2.ts']) {
    await writeFile(join(dir, path), 'export const v = 2\n')
  }
  return dir
}

// Only the Git effects are real; the cache/publish/generation collaborators are recorded.
function operations(): {
  ops: ReturnType<typeof createGitOperations>
  publish: ReturnType<typeof vi.fn>
} {
  const publish = vi.fn()
  const ops = createGitOperations({
    workspace: {} as GitWorkspacePort,
    projectGit: createProjectGit(),
    commitGeneration: {} as CommitGeneration,
    workspaceTrash: {} as WorkspaceTrash,
    workingTreeCache: { clear: vi.fn() } as WorkingTreeCache,
    changes: { publishChanged: publish } as GitChanges,
    diffReadingSources: {} as GitDiffReadingSources,
  })
  return { ops, publish }
}

function subjects(dir: string): string[] {
  return git(dir, 'log', '--format=%s').split('\n').filter(Boolean)
}

function filesIn(dir: string, ref: string): string[] {
  return git(dir, 'show', '--name-only', '--format=', ref).split('\n').filter(Boolean).sort()
}

afterAll(async () => {
  await Promise.all(repos.map((d) => rm(d, { recursive: true, force: true })))
})

describe('applyCommitGroupsGit', () => {
  it('commits each group in order with exactly its files', async () => {
    const dir = await makeRepo()
    const { ops, publish } = operations()
    const output = await ops.applyCommitGroupsGit({
      repoPath: dir,
      groups: [
        { files: ['a1.ts', 'a2.ts'], message: 'feat: group a' },
        { files: ['b1.ts', 'b2.ts'], message: 'fix: group b' },
        { files: ['c1.ts', 'c2.ts'], message: 'chore: group c' },
      ],
    })

    expect(output.results.map((r) => r.status)).toEqual(['committed', 'committed', 'committed'])
    expect(subjects(dir)).toEqual(['chore: group c', 'fix: group b', 'feat: group a', 'root'])
    expect(filesIn(dir, 'HEAD~2')).toEqual(['a1.ts', 'a2.ts'])
    expect(filesIn(dir, 'HEAD~1')).toEqual(['b1.ts', 'b2.ts'])
    expect(filesIn(dir, 'HEAD')).toEqual(['c1.ts', 'c2.ts'])
    expect(git(dir, 'status', '--porcelain').trim()).toBe('')
    expect(publish).toHaveBeenCalledWith(dir)
  })

  it('never leaks a pre-staged file into the first group', async () => {
    const dir = await makeRepo()
    // c1.ts is already in the index when Accept fires — a stale proposal or a manual stage.
    git(dir, 'add', 'c1.ts')
    const { ops } = operations()
    await ops.applyCommitGroupsGit({
      repoPath: dir,
      groups: [{ files: ['a1.ts'], message: 'feat: group a' }],
    })

    expect(filesIn(dir, 'HEAD')).toEqual(['a1.ts'])
    // c1.ts is back to a plain working-tree change, not silently committed.
    expect(git(dir, 'status', '--porcelain')).toContain(' M c1.ts')
  })

  it('stops at the first failure, keeps earlier commits, and leaves the index clean', async () => {
    const dir = await makeRepo()
    const { ops } = operations()
    const output = await ops.applyCommitGroupsGit({
      repoPath: dir,
      groups: [
        { files: ['a1.ts', 'a2.ts'], message: 'feat: group a' },
        // 'gone.ts' does not exist, so staging the group fails part-way through.
        { files: ['b1.ts', 'gone.ts'], message: 'fix: group b' },
        { files: ['c1.ts', 'c2.ts'], message: 'chore: group c' },
      ],
    })

    expect(output.results.map((r) => r.status)).toEqual(['committed', 'failed', 'skipped'])
    expect(output.results[1]?.error).toBeTruthy()
    expect(output.results[2]?.error).toBeNull()
    expect(subjects(dir)).toEqual(['feat: group a', 'root'])
    // b1.ts was staged before the group failed; the reset put it back in the working tree,
    // and every remaining file is still an unstaged change.
    const status = git(dir, 'status', '--porcelain').split('\n').filter(Boolean).sort()
    expect(status).toEqual([' M b1.ts', ' M b2.ts', ' M c1.ts', ' M c2.ts'])
  })

  it('reports a cleanup failure after a partial group instead of rejecting past landed work', async () => {
    const publish = vi.fn()
    let resetCalls = 0
    const projectGit = createProjectGit()
    const ops = createGitOperations({
      workspace: {} as GitWorkspacePort,
      projectGit: {
        ...projectGit,
        stageFile: async (_repoPath, path) => {
          if (path === 'gone.ts') throw new Error('stage failed')
        },
        unstageAll: async () => {
          resetCalls += 1
          if (resetCalls > 1) throw new Error('index locked')
        },
      },
      commitGeneration: {} as CommitGeneration,
      workspaceTrash: {} as WorkspaceTrash,
      workingTreeCache: { clear: vi.fn() } as WorkingTreeCache,
      changes: { publishChanged: publish } as GitChanges,
      diffReadingSources: {} as GitDiffReadingSources,
    })

    const output = await ops.applyCommitGroupsGit({
      repoPath: '/synthetic/repo',
      groups: [
        { files: ['gone.ts'], message: 'fix: impossible' },
        { files: ['later.ts'], message: 'fix: later' },
      ],
    })

    expect(output.results.map((result) => result.status)).toEqual(['failed', 'skipped'])
    expect(output.results[0]?.error).toContain('stage failed')
    expect(output.results[0]?.error).toContain('Could not restore the index: index locked')
    expect(publish).toHaveBeenCalledWith('/synthetic/repo')
  })
})

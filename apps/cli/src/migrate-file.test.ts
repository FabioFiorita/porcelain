import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from './cli'
import { describeMigrate, listProjectWorktrees } from './migrate-file'

let root = ''
let repoPath = ''
let homeDir = ''
const prevHome = process.env.PORCELAIN_HOME

function git(args: string[], cwd = repoPath): void {
  execFileSync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'T',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'T',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  })
}

function seedInventory(): void {
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'project-1',
            commonGitDir: realpathSync(join(repoPath, '.git')),
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees: [{ id: 'worktree-1', gitDir: realpathSync(join(repoPath, '.git')) }],
          },
        ],
      },
    }),
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-migrate-cli-'))
  repoPath = join(root, 'repo')
  homeDir = join(root, 'home')
  mkdirSync(join(repoPath, '.porcelain'), { recursive: true })
  git(['init', '--initial-branch=main'])
  writeFileSync(join(repoPath, 'README.md'), '# repo\n')
  git(['add', '.'])
  git(['commit', '-m', 'init'])
  seedInventory()
  process.env.PORCELAIN_HOME = homeDir
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})

describe('porcelain migrate apply', () => {
  it('runs the shared migration against this checkout and prints the report', async () => {
    writeFileSync(
      join(repoPath, '.porcelain', 'actions.json'),
      JSON.stringify({
        version: 1,
        actions: [{ id: 'a1', title: 'Verify', command: 'pnpm verify', order: 0, createdAt: 1 }],
      }),
    )

    const output = await runCli(['migrate', 'apply', '--repo', repoPath])

    expect(output).toContain('[converted] action: .porcelain/actions.json#a1')
    const stored = JSON.parse(
      readFileSync(join(homeDir, 'projects', 'project-1', 'actions.json'), 'utf8'),
    ) as { actions: { title: string }[] }
    expect(stored.actions.map((action) => action.title)).toEqual(['Verify'])
  })

  it('writes nothing under --dry-run and says so', async () => {
    writeFileSync(
      join(repoPath, '.porcelain', 'scope.json'),
      JSON.stringify({ hiddenPaths: ['apps/legacy'], pinnedPaths: [] }),
    )

    const output = await runCli(['migrate', 'apply', '--repo', repoPath, '--dry-run'])

    expect(output).toContain('nothing was written')
    expect(() =>
      readFileSync(join(homeDir, 'projects', 'project-1', 'project.json'), 'utf8'),
    ).toThrow()
  })

  it('also writes the report as JSON when asked', async () => {
    const reportPath = join(root, 'out', 'report.json')

    await runCli(['migrate', 'apply', '--repo', repoPath, '--report', reportPath])

    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { projectId: string }
    expect(report.projectId).toBe('project-1')
  })

  it('refuses a relative --report path', async () => {
    await expect(
      describeMigrate(repoPath, { dryRun: true, reportPath: 'report.json' }),
    ).rejects.toThrow('--report must be an absolute path')
  })

  it('lists only the Worktrees the Hub already knows, with their branch', () => {
    expect(listProjectWorktrees(repoPath)).toEqual([
      { id: 'worktree-1', path: realpathSync(repoPath), branch: 'main' },
    ])
  })
})

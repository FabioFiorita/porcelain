import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  gitDefaultBranch,
  gitMergeBase,
  gitRangeChangedFiles,
  gitRangeDiffFile,
  gitRangeNumstat,
  isNoMatchError,
  parseLooseIgnoredFiles,
  quickCommandArgs,
} from './git'

describe('isNoMatchError', () => {
  it('treats exit code 1 as no-match', () => {
    expect(isNoMatchError({ code: 1 })).toBe(true)
  })
  it('treats other exit codes and errors as real failures', () => {
    expect(isNoMatchError({ code: 2 })).toBe(false)
    expect(isNoMatchError({ code: 'ENOENT' })).toBe(false)
    expect(isNoMatchError(new Error('boom'))).toBe(false)
    expect(isNoMatchError(null)).toBe(false)
  })
})

describe('quickCommandArgs', () => {
  it('resolves static commands to their fixed args', () => {
    expect(quickCommandArgs('status')).toEqual(['status'])
    expect(quickCommandArgs('push')).toEqual(['push'])
    expect(quickCommandArgs('fetch')).toEqual(['fetch'])
    expect(quickCommandArgs('stash-pop')).toEqual(['stash', 'pop'])
  })

  it('appends the pull strategy flag so the choice beats the gitconfig default', () => {
    expect(quickCommandArgs('pull', 'merge')).toEqual(['pull', '--no-rebase'])
    expect(quickCommandArgs('pull', 'rebase')).toEqual(['pull', '--rebase'])
  })

  it('defaults pull to merge', () => {
    expect(quickCommandArgs('pull')).toEqual(['pull', '--no-rebase'])
  })

  it('ignores pullMode for non-pull commands', () => {
    expect(quickCommandArgs('fetch', 'rebase')).toEqual(['fetch'])
  })

  it('returns null for an unknown id', () => {
    expect(quickCommandArgs('rm-rf')).toBeNull()
  })
})

describe('parseLooseIgnoredFiles', () => {
  // input is the NUL-separated output of `git ls-files --others --ignored
  // --exclude-standard --directory`: collapsed wholly-ignored dirs end in `/`.
  it('keeps loose ignored files and drops collapsed dirs + .DS_Store', () => {
    const out = ['.env', 'node_modules/', 'dist/', '.DS_Store', 'apps/web/.env.local', ''].join(
      '\0',
    )
    expect(parseLooseIgnoredFiles(out)).toEqual(['.env', 'apps/web/.env.local'])
  })

  it('drops .DS_Store at any depth but keeps other dotfiles', () => {
    const out = ['apps/.DS_Store', 'apps/.npmrc'].join('\0')
    expect(parseLooseIgnoredFiles(out)).toEqual(['apps/.npmrc'])
  })

  it('returns nothing when every entry is a collapsed dir', () => {
    expect(parseLooseIgnoredFiles('node_modules/\0out/\0')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Range diff prototype
// ---------------------------------------------------------------------------

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
  GIT_AUTHOR_DATE: '2024-01-01T12:00:00Z',
  GIT_COMMITTER_DATE: '2024-01-01T12:00:00Z',
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...GIT_ENV },
    stdio: 'pipe',
  }).toString()
}

describe('range diff prototype', () => {
  let repoDir = ''
  let baseSha = ''

  beforeAll(async () => {
    repoDir = await mkdtemp(join(tmpdir(), 'porcelain-git-range-'))

    // Init repo on `main`
    git(repoDir, 'init', '-b', 'main')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')

    // Write base.ts and commit — this is the `main` branch tip
    await writeFile(join(repoDir, 'base.ts'), 'export const x = 1\n')
    git(repoDir, 'add', 'base.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'base')
    baseSha = git(repoDir, 'rev-parse', 'HEAD').trim()

    // Create `feature` branch from here, add feature.ts, modify base.ts
    git(repoDir, 'checkout', '-b', 'feature')
    await writeFile(join(repoDir, 'feature.ts'), 'export const y = 2\n')
    await writeFile(join(repoDir, 'base.ts'), 'export const x = 42\n')
    git(repoDir, 'add', 'feature.ts', 'base.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'feature')
  })

  afterAll(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true })
  })

  it('gitMergeBase returns the base branch tip SHA', async () => {
    const result = await gitMergeBase(repoDir, 'main')
    expect(result).toBe(baseSha)
  })

  it('gitRangeChangedFiles lists only the feature branch changes', async () => {
    const files = await gitRangeChangedFiles(repoDir, 'main')
    const paths = files.map((f) => f.path).sort()
    expect(paths).toEqual(['base.ts', 'feature.ts'])
    const baseTs = files.find((f) => f.path === 'base.ts')
    const featureTs = files.find((f) => f.path === 'feature.ts')
    expect(baseTs?.status).toBe('modified')
    expect(featureTs?.status).toBe('added')
  })

  it('gitRangeDiffFile returns hunks matching the branch change to base.ts', async () => {
    const hunks = await gitRangeDiffFile(repoDir, 'main', 'base.ts')
    expect(hunks.length).toBeGreaterThan(0)
    const allLines = hunks.flatMap((h) => h.lines)
    const addedLines = allLines.filter((l) => l.kind === 'add').map((l) => l.text)
    const removedLines = allLines.filter((l) => l.kind === 'del').map((l) => l.text)
    expect(addedLines.some((t) => t.includes('42'))).toBe(true)
    expect(removedLines.some((t) => t.includes('= 1'))).toBe(true)
  })

  it('gitDefaultBranch resolves to "main" when no remote but local main exists', async () => {
    const branch = await gitDefaultBranch(repoDir)
    expect(branch).toBe('main')
  })

  it('gitRangeNumstat returns +/- counts for base.ts and feature.ts', async () => {
    const stats = await gitRangeNumstat(repoDir, 'main')
    const baseTs = stats.find((s) => s.path === 'base.ts')
    const featureTs = stats.find((s) => s.path === 'feature.ts')
    expect(baseTs).toBeDefined()
    expect(baseTs?.additions).toBeGreaterThanOrEqual(1)
    expect(baseTs?.deletions).toBeGreaterThanOrEqual(1)
    expect(featureTs).toBeDefined()
    expect(featureTs?.additions).toBeGreaterThanOrEqual(1)
  })
})

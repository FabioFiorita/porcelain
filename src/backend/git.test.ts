import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  gitCommit,
  gitCommitNumstat,
  gitCreateBranch,
  gitDefaultBranch,
  gitFileInHead,
  gitFileLog,
  gitMergeBase,
  gitRangeChangedFiles,
  gitRangeDiffFile,
  gitRangeNumstat,
  gitResetPath,
  gitRestoreFromHead,
  gitStageAll,
  gitStageFile,
  gitUnstageAll,
  gitUnstageFile,
  isNoMatchError,
  parseLooseIgnoredFiles,
  quickCommandArgs,
  reuseIfUnchanged,
  reviewedFingerprint,
  reviewedFingerprints,
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

describe('reuseIfUnchanged', () => {
  it('returns the previous array object when content is identical (identity preserved)', () => {
    const previous = ['a.ts', 'b.ts']
    const next = ['a.ts', 'b.ts']
    expect(reuseIfUnchanged(previous, next)).toBe(previous)
  })
  it('returns the next array when content differs', () => {
    const previous = ['a.ts', 'b.ts']
    const next = ['a.ts', 'c.ts']
    expect(reuseIfUnchanged(previous, next)).toBe(next)
  })
  it('returns the next array on a length change', () => {
    const previous = ['a.ts']
    const next = ['a.ts', 'b.ts']
    expect(reuseIfUnchanged(previous, next)).toBe(next)
  })
  it('returns the next array when there is no previous entry', () => {
    const next = ['a.ts']
    expect(reuseIfUnchanged(undefined, next)).toBe(next)
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
    const { hunks, status } = await gitRangeDiffFile(repoDir, 'main', 'base.ts')
    expect(status).toBe('modified')
    expect(hunks.length).toBeGreaterThan(0)
    const allLines = hunks.flatMap((h) => h.lines)
    const addedLines = allLines.filter((l) => l.kind === 'add').map((l) => l.text)
    const removedLines = allLines.filter((l) => l.kind === 'del').map((l) => l.text)
    expect(addedLines.some((t) => t.includes('42'))).toBe(true)
    expect(removedLines.some((t) => t.includes('= 1'))).toBe(true)
  })

  it('gitRangeDiffFile reports an added file as added', async () => {
    const { status } = await gitRangeDiffFile(repoDir, 'main', 'feature.ts')
    expect(status).toBe('added')
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

// ---------------------------------------------------------------------------
// Mutation helpers — characterization / argv-pinning tests
// ---------------------------------------------------------------------------
//
// Each `it` gets its own fresh temp repo so mutations cannot bleed between cases.
// The repo helper commits a `tracked.ts` file so HEAD always exists.

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'porcelain-mut-'))
  git(dir, 'init', '-b', 'main')
  // Pin a local identity so production helpers (gitCommit) that spawn git with the
  // plain process env still commit on runners with no global user.name/user.email.
  git(dir, 'config', 'user.name', 'Test User')
  git(dir, 'config', 'user.email', 'test@porcelain.test')
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
  await writeFile(join(dir, 'tracked.ts'), 'export const v = 1\n')
  git(dir, 'add', 'tracked.ts')
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'add tracked.ts')
  return dir
}

describe('mutations', () => {
  const repos: string[] = []

  // Collect every repo so we can clean up after the whole suite.
  async function repo(): Promise<string> {
    const dir = await makeRepo()
    repos.push(dir)
    return dir
  }

  afterAll(async () => {
    await Promise.all(repos.map((d) => rm(d, { recursive: true, force: true })))
  })

  // ----- gitFileInHead (the trash-vs-revert guard) -------------------------

  it('gitFileInHead returns true for a committed/tracked file', async () => {
    const dir = await repo()
    expect(await gitFileInHead(dir, 'tracked.ts')).toBe(true)
  })

  it('gitFileInHead returns false for a brand-new untracked file', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'new.ts'), 'export const n = 2\n')
    expect(await gitFileInHead(dir, 'new.ts')).toBe(false)
  })

  it('gitFileInHead returns false for a staged-but-never-committed file', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'staged-new.ts'), 'export const s = 3\n')
    git(dir, 'add', 'staged-new.ts')
    // It's in the index but NOT in HEAD — cat-file -e HEAD:<path> must fail.
    expect(await gitFileInHead(dir, 'staged-new.ts')).toBe(false)
  })

  it('gitFileInHead returns false on a repo with no commit (unborn branch)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'porcelain-unborn-'))
    repos.push(dir)
    git(dir, 'init', '-b', 'main')
    // No commit — HEAD does not exist; cat-file will error → false.
    expect(await gitFileInHead(dir, 'anything.ts')).toBe(false)
  })

  it('gitFileInHead swallows ALL errors and returns false (not just "not-in-HEAD")', async () => {
    // Use a path that is syntactically invalid for cat-file (contains a NUL-like
    // sequence via an empty string); more reliably: pass a completely non-existent
    // repoPath so runGit itself errors (ENOENT).  The current implementation catches
    // every exception and returns false — this test pins that swallowing behavior.
    const nonExistentRepo = join(tmpdir(), 'no-such-repo-porcelain-xyz')
    expect(await gitFileInHead(nonExistentRepo, 'tracked.ts')).toBe(false)
  })

  // ----- gitStageFile / gitUnstageFile -------------------------------------

  it('gitStageFile moves a modified tracked file to the index', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 99\n')
    await gitStageFile(dir, 'tracked.ts')
    const status = git(dir, 'status', '--porcelain')
    // 'M ' means index-modified (first col), worktree-clean (second col).
    expect(status.trim()).toBe('M  tracked.ts')
  })

  it('gitUnstageFile returns a staged file to unstaged', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 99\n')
    git(dir, 'add', 'tracked.ts')
    await gitUnstageFile(dir, 'tracked.ts')
    const status = git(dir, 'status', '--porcelain')
    // ' M' means index-clean (first col), worktree-modified (second col).
    // Use trimEnd only — leading space is significant in porcelain format.
    expect(status.trimEnd()).toBe(' M tracked.ts')
  })

  // ----- gitStageAll / gitUnstageAll ---------------------------------------

  it('gitStageAll stages both a modified tracked file and a new untracked file', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 42\n')
    await writeFile(join(dir, 'brand-new.ts'), 'export const b = 1\n')
    await gitStageAll(dir)
    const lines = git(dir, 'status', '--porcelain').split('\n').filter(Boolean)
    const byPath = Object.fromEntries(lines.map((l) => [l.slice(3), l.slice(0, 2)]))
    // add -A stages modifications as 'M ' and new files as 'A '.
    expect(byPath['tracked.ts']).toBe('M ')
    expect(byPath['brand-new.ts']).toBe('A ')
  })

  it('gitUnstageAll unstages all staged changes back to unstaged/untracked', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 42\n')
    await writeFile(join(dir, 'brand-new.ts'), 'export const b = 1\n')
    git(dir, 'add', '-A')
    await gitUnstageAll(dir)
    // Split without trim so leading spaces (significant in porcelain format) are preserved.
    const lines = git(dir, 'status', '--porcelain').split('\n').filter(Boolean)
    const byPath = Object.fromEntries(lines.map((l) => [l.slice(3), l.slice(0, 2)]))
    // reset -q returns modifications to ' M' and new files to '??' (untracked).
    expect(byPath['tracked.ts']).toBe(' M')
    expect(byPath['brand-new.ts']).toBe('??')
  })

  // ----- gitRestoreFromHead ------------------------------------------------

  it('gitRestoreFromHead restores content AND leaves status clean for a staged+modified file', async () => {
    const dir = await repo()
    const filePath = join(dir, 'tracked.ts')
    const committed = readFileSync(filePath, 'utf8')
    await writeFile(filePath, 'export const v = 999\n')
    git(dir, 'add', 'tracked.ts')
    // Ensure it's staged before restore.
    expect(git(dir, 'status', '--porcelain').trim()).toBe('M  tracked.ts')
    await gitRestoreFromHead(dir, 'tracked.ts')
    // Working tree must match the committed content.
    expect(readFileSync(filePath, 'utf8')).toBe(committed)
    // Status must be completely clean (both index and worktree restored).
    expect(git(dir, 'status', '--porcelain').trim()).toBe('')
  })

  // ----- gitResetPath ------------------------------------------------------

  it('gitResetPath unstages a new file and leaves it on disk', async () => {
    const dir = await repo()
    const filePath = join(dir, 'to-discard.ts'),
      content = 'export const d = 7\n'
    await writeFile(filePath, content)
    git(dir, 'add', 'to-discard.ts')
    // Confirm it's staged as 'A '.
    expect(git(dir, 'status', '--porcelain').trim()).toBe('A  to-discard.ts')
    await gitResetPath(dir, 'to-discard.ts')
    // Must be untracked now, not staged.
    expect(git(dir, 'status', '--porcelain').trim()).toBe('?? to-discard.ts')
    // Working-tree file must still exist with its original content.
    expect(readFileSync(filePath, 'utf8')).toBe(content)
  })

  // ----- gitCommit ---------------------------------------------------------

  it('gitCommit commits the staged change and records the message', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 77\n')
    git(dir, 'add', 'tracked.ts')
    await gitCommit(dir, 'my commit message')
    const subject = git(dir, '-c', 'commit.gpgsign=false', 'log', '-1', '--pretty=%s').trim()
    expect(subject).toBe('my commit message')
    // The file must be committed (status clean).
    expect(git(dir, 'status', '--porcelain').trim()).toBe('')
  })

  it('gitCommit throws when nothing is staged and does not create a commit', async () => {
    const dir = await repo()
    const logBefore = git(dir, 'log', '--oneline').trim()
    // Unstaged change only — nothing in the index.
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 55\n')
    await expect(gitCommit(dir, 'should not exist')).rejects.toThrow()
    // Commit count must be unchanged.
    expect(git(dir, 'log', '--oneline').trim()).toBe(logBefore)
  })

  // ----- gitCreateBranch ---------------------------------------------------

  it('gitCreateBranch creates the branch and switches HEAD to it', async () => {
    const dir = await repo()
    await gitCreateBranch(dir, 'feature-x')
    // HEAD now reports the new branch as the current one.
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('feature-x')
  })

  it('gitCreateBranch throws git’s message when the branch already exists', async () => {
    const dir = await repo()
    git(dir, 'branch', 'dup')
    // A second create of the same name is git's error to surface, not ours.
    await expect(gitCreateBranch(dir, 'dup')).rejects.toThrow(/already exists/)
  })

  it('gitCreateBranch rejects a name starting with a dash (no option injection)', async () => {
    const dir = await repo()
    // `checkout -b -foo` treats `-foo` as an invalid ref name, not a flag — git
    // rejects it. This pins the no-option-injection property of the argv.
    await expect(gitCreateBranch(dir, '-foo')).rejects.toThrow()
    // HEAD must still be on the original branch (no branch was created/switched).
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main')
  })
})

// ---------------------------------------------------------------------------
// gitCommitNumstat
// ---------------------------------------------------------------------------

describe('gitCommitNumstat', () => {
  let repoDir = ''
  let rootHash = ''
  let addHash = ''
  let modifyHash = ''

  beforeAll(async () => {
    repoDir = await mkdtemp(join(tmpdir(), 'porcelain-numstat-'))

    // Root commit (empty — no files yet, diffs vs empty tree)
    git(repoDir, 'init', '-b', 'main')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
    rootHash = git(repoDir, 'rev-parse', 'HEAD').trim()

    // Add two files (+1 line each)
    await writeFile(join(repoDir, 'alpha.ts'), 'export const a = 1\n')
    await writeFile(join(repoDir, 'beta.ts'), 'export const b = 2\n')
    git(repoDir, 'add', 'alpha.ts', 'beta.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'add files')
    addHash = git(repoDir, 'rev-parse', 'HEAD').trim()

    // Modify alpha (+1 -1) and add a line to beta (+1)
    await writeFile(join(repoDir, 'alpha.ts'), 'export const a = 42\n')
    await writeFile(join(repoDir, 'beta.ts'), 'export const b = 2\nexport const c = 3\n')
    git(repoDir, 'add', 'alpha.ts', 'beta.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'modify files')
    modifyHash = git(repoDir, 'rev-parse', 'HEAD').trim()
  })

  afterAll(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true })
  })

  it('returns empty array for a root commit with no files (diffs vs empty tree)', async () => {
    const stats = await gitCommitNumstat(repoDir, rootHash)
    expect(stats).toEqual([])
  })

  it('returns correct +/- counts for a commit that adds two files', async () => {
    const stats = await gitCommitNumstat(repoDir, addHash)
    const alpha = stats.find((s) => s.path === 'alpha.ts')
    const beta = stats.find((s) => s.path === 'beta.ts')
    expect(alpha).toBeDefined()
    expect(alpha?.additions).toBe(1)
    expect(alpha?.deletions).toBe(0)
    expect(beta).toBeDefined()
    expect(beta?.additions).toBe(1)
    expect(beta?.deletions).toBe(0)
  })

  it('returns correct +/- counts for a commit that modifies files', async () => {
    const stats = await gitCommitNumstat(repoDir, modifyHash)
    const alpha = stats.find((s) => s.path === 'alpha.ts')
    const beta = stats.find((s) => s.path === 'beta.ts')
    expect(alpha).toBeDefined()
    expect(alpha?.additions).toBe(1)
    expect(alpha?.deletions).toBe(1)
    expect(beta).toBeDefined()
    expect(beta?.additions).toBe(1)
    expect(beta?.deletions).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// gitFileLog — the file timeline (one file's history, following renames)
// ---------------------------------------------------------------------------

describe('gitFileLog', () => {
  let repoDir = ''

  beforeAll(async () => {
    repoDir = await mkdtemp(join(tmpdir(), 'porcelain-file-log-'))
    git(repoDir, 'init', '-b', 'main')

    // Add a.ts, then modify it, then rename it to b.ts — three commits touching
    // the same file across a rename. A sibling file proves the log is scoped.
    await writeFile(join(repoDir, 'a.ts'), 'export const a = 1\n')
    await writeFile(join(repoDir, 'other.ts'), 'export const o = 0\n')
    git(repoDir, 'add', 'a.ts', 'other.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'add a')

    await writeFile(join(repoDir, 'a.ts'), 'export const a = 42\n')
    git(repoDir, 'add', 'a.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'modify a')

    git(repoDir, 'mv', 'a.ts', 'b.ts')
    git(repoDir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'rename a to b')
  })

  afterAll(async () => {
    if (repoDir) await rm(repoDir, { recursive: true, force: true })
  })

  it('follows the file across a rename and lists its commits newest-first', async () => {
    const commits = await gitFileLog(repoDir, join(repoDir, 'b.ts'), 50)
    expect(commits.map((c) => c.subject)).toEqual(['rename a to b', 'modify a', 'add a'])
    expect(commits.every((c) => c.author === 'Test User')).toBe(true)
  })

  it('scopes the log to the one file, not the whole repo', async () => {
    const commits = await gitFileLog(repoDir, join(repoDir, 'other.ts'), 50)
    expect(commits.map((c) => c.subject)).toEqual(['add a'])
  })

  it('accepts a repo-relative path as well as an absolute one', async () => {
    const commits = await gitFileLog(repoDir, 'b.ts', 50)
    expect(commits.map((c) => c.subject)).toEqual(['rename a to b', 'modify a', 'add a'])
  })

  it('returns no commits for an untracked file', async () => {
    await writeFile(join(repoDir, 'untracked.ts'), 'export const u = 9\n')
    expect(await gitFileLog(repoDir, join(repoDir, 'untracked.ts'), 50)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// reviewedFingerprint: the content key for a reviewed mark (sha256 of the file's
// diff vs HEAD; untracked files hash their bytes). Assert relational semantics —
// same content ⇒ same hash, changed content / committed change ⇒ different hash —
// rather than exact digests. makeRepo commits a `tracked.ts` so HEAD exists.
// ---------------------------------------------------------------------------

describe('reviewedFingerprint', () => {
  const repos: string[] = []
  async function repo(): Promise<string> {
    const dir = await makeRepo()
    repos.push(dir)
    return dir
  }
  afterAll(async () => {
    await Promise.all(repos.map((d) => rm(d, { recursive: true, force: true })))
  })

  it('fingerprints a modified tracked file by its diff, changing when the content changes', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 2\n')
    const fp1 = await reviewedFingerprint(dir, 'tracked.ts')
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 3\n')
    const fp2 = await reviewedFingerprint(dir, 'tracked.ts')
    expect(fp1).not.toBe('')
    expect(fp2).not.toBe(fp1)
  })

  it('stops matching once the change is committed (diff vs HEAD goes empty)', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 2\n')
    const before = await reviewedFingerprint(dir, 'tracked.ts')
    git(dir, 'add', 'tracked.ts')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'change tracked')
    // A mark taken pre-commit reconciles as stale: the fingerprint no longer matches.
    expect(await reviewedFingerprint(dir, 'tracked.ts')).not.toBe(before)
  })

  it('gives a clean tracked file a stable fingerprint, distinct from a modified one', async () => {
    const dir = await repo()
    const clean = await reviewedFingerprint(dir, 'tracked.ts')
    await writeFile(join(dir, 'tracked.ts'), 'export const v = 2\n')
    const modified = await reviewedFingerprint(dir, 'tracked.ts')
    git(dir, 'checkout', '--', 'tracked.ts')
    expect(await reviewedFingerprint(dir, 'tracked.ts')).toBe(clean)
    expect(modified).not.toBe(clean)
  })

  it('fingerprints an untracked file by its bytes (no diff vs HEAD)', async () => {
    const dir = await repo()
    await writeFile(join(dir, 'new.ts'), 'export const n = 1\n')
    const fp1 = await reviewedFingerprint(dir, 'new.ts')
    await writeFile(join(dir, 'new.ts'), 'export const n = 2\n')
    const fp2 = await reviewedFingerprint(dir, 'new.ts')
    expect(fp1).not.toBe('')
    expect(fp2).not.toBe(fp1)
  })

  it('does not throw on a repo with no HEAD (unborn branch)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'porcelain-fp-unborn-'))
    repos.push(dir)
    git(dir, 'init', '-b', 'main')
    await writeFile(join(dir, 'a.ts'), 'export const a = 1\n')
    expect(await reviewedFingerprint(dir, 'a.ts')).not.toBe('')
  })
})

// ---------------------------------------------------------------------------
// reviewedFingerprints: the batched form, one git diff for all paths. Assert it
// returns exactly what per-file reviewedFingerprint returns, so the reconcile poll
// can trade N spawns for one without changing which marks survive.
// ---------------------------------------------------------------------------

describe('reviewedFingerprints', () => {
  const repos: string[] = []
  afterAll(async () => {
    await Promise.all(repos.map((d) => rm(d, { recursive: true, force: true })))
  })

  it('returns an empty map (and spawns no git) for no paths', async () => {
    expect(await reviewedFingerprints('/nonexistent-repo', [])).toEqual(new Map())
  })

  it('matches per-file reviewedFingerprint across a mixed set of paths', async () => {
    const dir = await makeRepo()
    repos.push(dir)
    // Extra committed files: clean.ts stays untouched; doomed.ts gets deleted; with
    // space.ts exercises an unquoted spaced path in the diff header.
    await writeFile(join(dir, 'clean.ts'), 'export const c = 1\n')
    await writeFile(join(dir, 'doomed.ts'), 'export const d = 1\n')
    await writeFile(join(dir, 'with space.ts'), 'export const s = 1\n')
    git(dir, 'add', 'clean.ts', 'doomed.ts', 'with space.ts')
    git(dir, '-c', 'commit.gpgsign=false', 'commit', '-m', 'add more')

    await writeFile(join(dir, 'tracked.ts'), 'export const v = 2\n') // modified tracked
    await writeFile(join(dir, 'new.ts'), 'export const n = 1\n') // untracked
    await writeFile(join(dir, 'with space.ts'), 'export const s = 2\n') // modified, spaced name
    git(dir, 'rm', 'doomed.ts') // deleted tracked

    const paths = ['tracked.ts', 'new.ts', 'clean.ts', 'doomed.ts', 'with space.ts']
    const batch = await reviewedFingerprints(dir, paths)
    for (const path of paths) {
      expect(batch.get(path)).toBe(await reviewedFingerprint(dir, path))
    }
  })

  it('matches per-file reviewedFingerprint on an unborn-branch repo', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'porcelain-fps-unborn-'))
    repos.push(dir)
    git(dir, 'init', '-b', 'main')
    await writeFile(join(dir, 'a.ts'), 'export const a = 1\n')
    await writeFile(join(dir, 'b.ts'), 'export const b = 1\n')
    const batch = await reviewedFingerprints(dir, ['a.ts', 'b.ts'])
    expect(batch.get('a.ts')).toBe(await reviewedFingerprint(dir, 'a.ts'))
    expect(batch.get('b.ts')).toBe(await reviewedFingerprint(dir, 'b.ts'))
  })
})

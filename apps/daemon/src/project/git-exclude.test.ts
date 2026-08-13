import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectPorcelainDir } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '../git/git-env'
import {
  ensureCompanionHidden,
  hideCompanion,
  isCompanionHidden,
  resetCompanionHiddenMemo,
  unhideCompanion,
} from './git-exclude'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  // gitEnv, not process.env: an inherited GIT_DIR would aim every fixture
  // command at the real repository (Git boundary, synthetic fixture only).
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

let root = ''
let repo = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-exclude-'))
  repo = join(root, 'repo')
  await mkdir(repo, { recursive: true })
  git(repo, 'init', '-b', 'main')
  await writeFile(join(repo, 'README.md'), '# fixture\n')
  git(repo, 'add', 'README.md')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base')
  resetCompanionHiddenMemo()
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function writeCompanionFile(name: string, body = '{}'): Promise<void> {
  await mkdir(projectPorcelainDir(repo), { recursive: true })
  await writeFile(join(projectPorcelainDir(repo), name), body)
}

const excludePath = (): string => join(repo, '.git', 'info', 'exclude')

describe('hiding the companion from git', () => {
  it('makes a written companion invisible to status', async () => {
    expect(await hideCompanion(repo)).toBe(true)
    await writeCompanionFile('board.json')
    expect(git(repo, 'status', '--porcelain=v1', '-uall').trim()).toBe('')
    expect(await isCompanionHidden(repo)).toBe(true)
  })

  it('is idempotent — one line, however many times it runs', async () => {
    expect(await hideCompanion(repo)).toBe(true)
    expect(await hideCompanion(repo)).toBe(false)
    const text = await readFile(excludePath(), 'utf8')
    expect(text.split('\n').filter((l) => l.trim() === '.porcelain/')).toHaveLength(1)
  })

  it('keeps every other exclude rule when it unhides', async () => {
    await writeFile(excludePath(), '# mine\nscratch/\n*.log\n')
    await hideCompanion(repo)
    expect(await unhideCompanion(repo)).toBe(true)
    const text = await readFile(excludePath(), 'utf8')
    expect(text).toContain('scratch/')
    expect(text).toContain('*.log')
    expect(text).not.toContain('.porcelain/')
    expect(await isCompanionHidden(repo)).toBe(false)
  })

  it('hands over to the inner .gitignore once unhidden', async () => {
    await hideCompanion(repo)
    await writeCompanionFile('board.json')
    await unhideCompanion(repo)
    expect(git(repo, 'status', '--porcelain=v1', '-uall')).toContain('.porcelain/board.json')
  })

  it('never blocks a publish — force-add reaches through the exclude', async () => {
    await hideCompanion(repo)
    await mkdir(join(projectPorcelainDir(repo), 'reviews', 'r1'), { recursive: true })
    await writeFile(join(projectPorcelainDir(repo), 'reviews', 'r1', 'review.json'), '{}')
    git(repo, 'add', '-f', '--', '.porcelain/reviews/r1')
    expect(git(repo, 'status', '--porcelain=v1')).toContain('.porcelain/reviews/r1/review.json')
  })

  it('does nothing outside a git repository', async () => {
    const plain = join(root, 'plain')
    await mkdir(plain, { recursive: true })
    expect(await hideCompanion(plain)).toBe(false)
    expect(await isCompanionHidden(plain)).toBe(false)
  })
})

describe('the first-write decision', () => {
  it('hides a repo that has never shared a companion', async () => {
    await ensureCompanionHidden(repo)
    expect(await isCompanionHidden(repo)).toBe(true)
  })

  it('leaves a repo alone when the team already tracks a companion', async () => {
    // Someone committed companion data for the team — excluding here would leave
    // a half-state where their files show and new ones silently do not.
    await writeCompanionFile('actions.json', '[]')
    git(repo, 'add', '-f', '--', '.porcelain/actions.json')
    git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'share companion')
    resetCompanionHiddenMemo()

    await ensureCompanionHidden(repo)
    expect(await isCompanionHidden(repo)).toBe(false)
  })

  it('decides once per repo per process', async () => {
    await ensureCompanionHidden(repo)
    await unhideCompanion(repo)
    // A later companion write must not silently re-hide what the human revealed.
    await ensureCompanionHidden(repo)
    expect(await isCompanionHidden(repo)).toBe(false)
  })
})

describe('worktrees share one decision', () => {
  it('applies to a linked worktree, because info/ resolves to the common dir', async () => {
    const wt = join(root, 'wt')
    git(repo, 'worktree', 'add', '-q', '-b', 'side', wt)
    await hideCompanion(repo)

    // Written from the WORKTREE, read by the worktree's own status.
    await mkdir(join(wt, '.porcelain'), { recursive: true })
    await writeFile(join(wt, '.porcelain', 'board.json'), '{}')
    expect(git(wt, 'status', '--porcelain=v1', '-uall').trim()).toBe('')

    // And the worktree agrees about the state without its own exclude file.
    expect(await isCompanionHidden(wt)).toBe(true)
  })
})

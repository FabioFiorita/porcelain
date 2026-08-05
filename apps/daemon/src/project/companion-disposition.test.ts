import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '../git/git-env'
import { readChannelDispositions, setChannelDisposition } from './companion-disposition'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  // gitEnv, not a bare process.env: an inherited GIT_DIR would point every
  // fixture command at the real repository (see the audit skill).
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

let repo = ''

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), 'porcelain-disposition-'))
  git(repo, 'init', '-b', 'main')
  await mkdir(projectPorcelainDir(repo), { recursive: true })
  await writeFile(projectPorcelainPath(repo, PROJECT_FILES.gitignore), DEFAULT_PROJECT_GITIGNORE)
})

afterEach(async () => {
  await rm(repo, { recursive: true, force: true })
})

async function commitCompanion(...names: string[]): Promise<void> {
  for (const name of names) {
    await writeFile(projectPorcelainPath(repo, name), '[]')
  }
  git(repo, 'add', '-f', '--', '.porcelain')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'companion')
}

describe('companion dispositions', () => {
  it('reports the shipped defaults', async () => {
    const state = await readChannelDispositions(repo)
    const byKey = Object.fromEntries(state.map((c) => [c.key, c.disposition]))
    expect(byKey.actions).toBe('shared')
    expect(byKey.notes).toBe('shared')
    expect(byKey.board).toBe('local')
    expect(byKey.reviews).toBe('local')
  })

  it('untracks a channel when it goes local, keeping the file on disk', async () => {
    await commitCompanion(PROJECT_FILES.actions)
    expect(
      (await readChannelDispositions(repo)).find((c) => c.key === 'actions')?.trackedPaths,
    ).toEqual(['.porcelain/actions.json'])

    const result = await setChannelDisposition(repo, 'actions', 'local')
    expect(result.untracked).toEqual(['.porcelain/actions.json'])

    // Still on disk — "local" moves nothing, it only changes git's disposition.
    expect(await readFile(projectPorcelainPath(repo, PROJECT_FILES.actions), 'utf8')).toBe('[]')
    expect(git(repo, 'ls-files', '--', '.porcelain/actions.json').trim()).toBe('')

    const state = await readChannelDispositions(repo)
    expect(state.find((c) => c.key === 'actions')?.disposition).toBe('local')
  })

  it('is idempotent when the channel was never tracked', async () => {
    const result = await setChannelDisposition(repo, 'board', 'local')
    expect(result.untracked).toEqual([])
  })

  it('going shared removes the ignore without staging anything', async () => {
    await setChannelDisposition(repo, 'board', 'shared')
    const state = await readChannelDispositions(repo)
    expect(state.find((c) => c.key === 'board')?.disposition).toBe('shared')
    // Staging stays the human's act, exactly like gitCommit never auto-staging.
    expect(git(repo, 'status', '--porcelain=v1').includes('A  .porcelain/board.json')).toBe(false)
  })

  it('untracks a whole directory channel', async () => {
    await mkdir(join(projectPorcelainDir(repo), 'reviews', 'r1'), { recursive: true })
    await writeFile(join(projectPorcelainDir(repo), 'reviews', 'r1', 'review.json'), '{}')
    git(repo, 'add', '-f', '--', '.porcelain/reviews')
    git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'reviews')

    const result = await setChannelDisposition(repo, 'reviews', 'local')
    expect(result.untracked).toEqual(['.porcelain/reviews/r1/review.json'])
    expect(git(repo, 'ls-files', '--', '.porcelain/reviews').trim()).toBe('')
  })

  it('preserves the human lines in .gitignore across a flip', async () => {
    const path = projectPorcelainPath(repo, PROJECT_FILES.gitignore)
    await writeFile(path, `${DEFAULT_PROJECT_GITIGNORE}\n# mine\nscratch/\n`)
    await setChannelDisposition(repo, 'board', 'shared')
    const text = await readFile(path, 'utf8')
    expect(text).toContain('# mine')
    expect(text).toContain('scratch/')
  })
})

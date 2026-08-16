// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { describe, expect, it } from 'vitest'
import { gitEnv } from '../../git/git-env'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { readChannelDispositions, setChannelDisposition } from './gitignore-dispositions'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test User',
  GIT_AUTHOR_EMAIL: 'test@porcelain.test',
  GIT_COMMITTER_NAME: 'Test User',
  GIT_COMMITTER_EMAIL: 'test@porcelain.test',
}

function git(cwd: string, ...args: string[]): string {
  // gitEnv, not a bare process.env: an inherited GIT_DIR would point every
  // fixture command at the real repository (Git boundary, synthetic fixture only).
  return execFileSync('git', args, {
    cwd,
    env: gitEnv(process.env, GIT_ENV),
    stdio: 'pipe',
  }).toString()
}

async function withDispositionRepo(run: (repo: string) => Promise<void>): Promise<void> {
  await withTemporaryDirectory('porcelain-disposition-', async (repo) => {
    git(repo, 'init', '-b', 'main')
    await mkdir(projectPorcelainDir(repo), { recursive: true })
    await writeFile(projectPorcelainPath(repo, PROJECT_FILES.gitignore), DEFAULT_PROJECT_GITIGNORE)
    await run(repo)
  })
}

async function commitCompanion(repo: string, ...names: string[]): Promise<void> {
  for (const name of names) {
    await writeFile(projectPorcelainPath(repo, name), '[]')
  }
  git(repo, 'add', '-f', '--', '.porcelain')
  git(repo, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'companion')
}

describe('companion dispositions', () => {
  it('reports the shipped defaults', async () => {
    await withDispositionRepo(async (repo) => {
      const state = await readChannelDispositions(repo)
      const byKey = Object.fromEntries(state.map((c) => [c.key, c.disposition]))
      expect(byKey.actions).toBe('shared')
    })
  })

  it('untracks a channel when it goes local, keeping the file on disk', async () => {
    await withDispositionRepo(async (repo) => {
      await commitCompanion(repo, PROJECT_FILES.actions)
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
  })

  it('is idempotent when the channel was never tracked', async () => {
    await withDispositionRepo(async (repo) => {
      const result = await setChannelDisposition(repo, 'actions', 'local')
      expect(result.untracked).toEqual([])
    })
  })

  it('going shared removes the ignore without staging anything', async () => {
    await withDispositionRepo(async (repo) => {
      await setChannelDisposition(repo, 'actions', 'shared')
      const state = await readChannelDispositions(repo)
      expect(state.find((c) => c.key === 'actions')?.disposition).toBe('shared')
      // Staging stays the human's act, exactly like gitCommit never auto-staging.
      expect(git(repo, 'status', '--porcelain=v1').includes('A  .porcelain/actions.json')).toBe(
        false,
      )
    })
  })

  it('preserves the human lines in .gitignore across a flip', async () => {
    await withDispositionRepo(async (repo) => {
      const path = projectPorcelainPath(repo, PROJECT_FILES.gitignore)
      await writeFile(path, `${DEFAULT_PROJECT_GITIGNORE}\n# mine\nscratch/\n`)
      await setChannelDisposition(repo, 'actions', 'shared')
      const text = await readFile(path, 'utf8')
      expect(text).toContain('# mine')
      expect(text).toContain('scratch/')
    })
  })
})

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runCli } from './cli'
import {
  clearWorktreeProfile,
  readProjectProfile,
  readWorktreeProfile,
  setProjectProfile,
  setWorktreeProfile,
} from './profile-file'

/**
 * The CLI half of the worktree profile, proved against a real temp checkout and
 * a real `hub-inventory.json` — the daemon reads the same file back, so the
 * bytes on disk are the contract, not the return value.
 */

let root = ''
let repoPath = ''
let homeDir = ''
const prevHome = process.env.PORCELAIN_HOME

const documentPath = (): string => join(homeDir, 'projects', 'proj-1', 'project.json')
const readDocument = (): Record<string, unknown> =>
  JSON.parse(readFileSync(documentPath(), 'utf8')) as Record<string, unknown>

function seedInventory(worktrees: Array<{ id?: string; gitDir: string }>): void {
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'proj-1',
            commonGitDir: realpathSync(join(repoPath, '.git')),
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees,
          },
        ],
      },
    }),
  )
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-profile-cli-'))
  repoPath = join(root, 'repo')
  homeDir = join(root, 'home')
  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoPath })
  process.env.PORCELAIN_HOME = homeDir
  seedInventory([{ id: 'wt-1', gitDir: realpathSync(join(repoPath, '.git')) }])
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})

describe('the project profile', () => {
  it('is empty before anyone declares one', () => {
    expect(readProjectProfile(repoPath)).toEqual({
      pinnedPaths: [],
      hiddenPaths: [],
      layers: [],
    })
  })

  it('round-trips through the daemon-root private record', () => {
    setProjectProfile(repoPath, {
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
      layers: [{ label: 'View', pattern: 'components/' }],
    })

    expect(readProjectProfile(repoPath)).toEqual({
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
      layers: [{ label: 'View', pattern: 'components/' }],
    })
  })

  it('replaces wholesale rather than merging (ADR 0006)', () => {
    setProjectProfile(repoPath, { pinnedPaths: ['README.md'], hiddenPaths: [], layers: [] })
    setProjectProfile(repoPath, { pinnedPaths: [], hiddenPaths: ['dist'], layers: [] })

    expect(readProjectProfile(repoPath).pinnedPaths).toEqual([])
  })

  it('never writes into the checkout', () => {
    setProjectProfile(repoPath, { pinnedPaths: ['README.md'], hiddenPaths: [], layers: [] })

    const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
      cwd: repoPath,
      encoding: 'utf8',
    })
    expect(status.trim()).toBe('')
  })
})

describe('the worktree override', () => {
  it('is absent until this worktree declares one', () => {
    expect(readWorktreeProfile(repoPath)).toBeNull()
  })

  it('stores under the worktree id, beside the project baseline', () => {
    setProjectProfile(repoPath, { pinnedPaths: ['README.md'], hiddenPaths: [], layers: [] })
    setWorktreeProfile(repoPath, {
      pinnedPaths: ['apps/mobile'],
      hiddenPaths: [],
      unhiddenPaths: ['dist'],
      layers: null,
    })

    const document = readDocument()
    expect(document.pinnedPaths).toEqual(['README.md'])
    expect(document.worktreeProfiles).toEqual({
      'wt-1': {
        pinnedPaths: ['apps/mobile'],
        hiddenPaths: [],
        unhiddenPaths: ['dist'],
        layers: null,
      },
    })
  })

  /**
   * The whole point of two levels: writing one worktree's focus must not disturb
   * the baseline every other worktree is reading through.
   */
  it('leaves the project baseline alone', () => {
    setProjectProfile(repoPath, {
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
      layers: [{ label: 'View', pattern: 'components/' }],
    })
    setWorktreeProfile(repoPath, {
      pinnedPaths: [],
      hiddenPaths: ['apps/web'],
      unhiddenPaths: [],
      layers: [{ label: 'Screen', pattern: 'screens/' }],
    })

    expect(readProjectProfile(repoPath)).toEqual({
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
      layers: [{ label: 'View', pattern: 'components/' }],
    })
  })

  it('goes back to inheriting when cleared', () => {
    setWorktreeProfile(repoPath, {
      pinnedPaths: ['apps/mobile'],
      hiddenPaths: [],
      unhiddenPaths: [],
      layers: null,
    })
    clearWorktreeProfile(repoPath)

    expect(readWorktreeProfile(repoPath)).toBeNull()
    expect(readDocument().worktreeProfiles).toEqual({})
  })

  it('refuses to write for a checkout with no Worktree id, and says why', () => {
    seedInventory([{ gitDir: realpathSync(join(repoPath, '.git')) }])

    expect(() =>
      setWorktreeProfile(repoPath, {
        pinnedPaths: [],
        hiddenPaths: [],
        unhiddenPaths: [],
        layers: null,
      }),
    ).toThrow(/open it in Porcelain once/)
  })
})

describe('the CLI surface', () => {
  it('sets and reads the project profile', async () => {
    await runCli([
      'profile',
      'set',
      '--repo',
      repoPath,
      '--profile',
      JSON.stringify({
        pinnedPaths: ['README.md'],
        hiddenPaths: ['dist'],
        layers: [{ label: 'View', pattern: 'components/' }],
      }),
    ])

    const output = await runCli(['profile', 'get', '--repo', repoPath])
    expect(output).toContain('README.md')
    expect(output).toContain('View')
  })

  it('says plainly when a worktree is inheriting', async () => {
    const output = await runCli(['worktree', 'profile', 'get', '--repo', repoPath])
    expect(output).toContain('no override')
  })

  it('shows both levels once an override exists', async () => {
    await runCli([
      'profile',
      'set',
      '--repo',
      repoPath,
      '--profile',
      JSON.stringify({ pinnedPaths: ['README.md'], hiddenPaths: [], layers: [] }),
    ])
    const output = await runCli([
      'worktree',
      'profile',
      'set',
      '--repo',
      repoPath,
      '--profile',
      JSON.stringify({ pinnedPaths: ['apps/mobile'] }),
    ])

    expect(output).toContain('README.md')
    expect(output).toContain('apps/mobile')
    expect(output).toContain('This worktree also declares')
  })

  it('drops the override on clear', async () => {
    await runCli([
      'worktree',
      'profile',
      'set',
      '--repo',
      repoPath,
      '--profile',
      JSON.stringify({ hiddenPaths: ['apps/web'] }),
    ])
    const output = await runCli(['worktree', 'profile', 'clear', '--repo', repoPath])

    expect(output).toContain('no override')
  })

  it('offers help rather than an error for a bare "worktree"', async () => {
    const output = await runCli(['worktree', 'profile'])
    expect(output).toContain('profile clear')
  })
})

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createAction,
  deleteAction,
  describeActions,
  readActions,
  updateAction,
} from './action-file'

let root = ''
let repo = ''
let homeDir = ''
const prevHome = process.env.PORCELAIN_HOME
const PROJECT_ID = 'proj-actions'

/** The daemon writes this when a repo is first opened; the CLI reads it, never mints ids. */
function seedInventory(): void {
  const commonGitDir = realpathSync(join(repo, '.git'))
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: PROJECT_ID,
            commonGitDir,
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees: [{ id: 'wt-1', gitDir: commonGitDir }],
          },
        ],
      },
    }),
  )
}

function storePath(): string {
  return join(homeDir, 'projects', PROJECT_ID, 'actions.json')
}

describe('describeActions', () => {
  it('explains an empty list', () => {
    expect(describeActions('/synthetic/repo', [])).toContain('No saved actions')
  })

  it('lists each action with id, command, and where', () => {
    const text = describeActions('/synthetic/repo', [
      { id: 'a1', title: 'Storybook', command: 'pnpm storybook', order: 1, createdAt: 1 },
      {
        id: 'a2',
        title: 'iOS',
        command: 'xcodebuild',
        where: 'local',
        order: 2,
        createdAt: 2,
      },
    ])
    expect(text).toContain('[a1] Storybook')
    expect(text).toContain('$ pnpm storybook')
    expect(text).toContain('[a2] iOS')
    expect(text).toContain('where: local')
  })
})

describe('action-file round-trip', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'porcelain-action-cli-'))
    repo = join(root, 'repo')
    homeDir = join(root, 'home')
    mkdirSync(repo, { recursive: true })
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: repo })
    process.env.PORCELAIN_HOME = homeDir
    seedInventory()
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    if (prevHome === undefined) delete process.env.PORCELAIN_HOME
    else process.env.PORCELAIN_HOME = prevHome
  })

  it('creates, updates, and deletes an action as a strict v1 document', () => {
    const action = createAction(repo, 'Storybook', 'pnpm storybook', undefined)
    expect(readActions(repo)).toHaveLength(1)
    const raw = JSON.parse(readFileSync(storePath(), 'utf8')) as {
      version: number
      actions: unknown[]
    }
    expect(raw.version).toBe(1)
    expect(Array.isArray(raw.actions)).toBe(true)
    expect(updateAction(repo, action.id, { command: 'pnpm sb' })).toBe(true)
    expect(readActions(repo)[0]?.command).toBe('pnpm sb')
    expect(deleteAction(repo, action.id)).toBe(true)
    expect(readActions(repo)).toEqual([])
  })

  it('writes into the daemon Project store, never into the checkout', () => {
    createAction(repo, 'Storybook', 'pnpm storybook', undefined)
    expect(existsSync(storePath())).toBe(true)
    expect(existsSync(join(repo, '.porcelain', 'actions.json'))).toBe(false)
    expect(existsSync(join(repo, '.porcelain'))).toBe(false)
  })

  it('keeps the actions when the checkout they were written from is deleted', () => {
    const action = createAction(repo, 'Storybook', 'pnpm storybook', undefined)
    rmSync(repo, { recursive: true, force: true })
    const stored = JSON.parse(readFileSync(storePath(), 'utf8')) as {
      actions: Array<{ id: string }>
    }
    expect(stored.actions.map((entry) => entry.id)).toEqual([action.id])
  })

  it('refuses to write for a repository no Environment has registered', () => {
    const stranger = join(root, 'stranger')
    mkdirSync(stranger, { recursive: true })
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: stranger })
    expect(() => createAction(stranger, 'Storybook', 'pnpm storybook', undefined)).toThrow(
      /not registered with a Porcelain Environment/,
    )
  })

  it('persists where: local and clears it back to primary', () => {
    const action = createAction(repo, 'iOS', 'xcodebuild', 'local')
    expect(readActions(repo)[0]?.where).toBe('local')
    expect(updateAction(repo, action.id, { where: 'primary' })).toBe(true)
    expect(readActions(repo)[0]?.where).toBeUndefined()
  })

  it('returns false updating or deleting an unknown id', () => {
    expect(updateAction(repo, 'nope', { title: 'x' })).toBe(false)
    expect(deleteAction(repo, 'nope')).toBe(false)
  })
})

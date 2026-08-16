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
import { type CanvasRecord, promoteCanvas, setCanvas } from './canvas-file'
import { revealCompanionOverlay } from './git-exclude'
import { promoteOverrides, readOverrides } from './overlay-file'

/**
 * The CLI half of the Git overlay (#26), proved against real temp checkouts and
 * real `git init` — the promoted bytes are only interesting because git can see
 * them, which no fs mock can tell us.
 */

let root = ''
let repoPath = ''
let otherRepo = ''
let homeDir = ''
let sourceDir = ''
const prevHome = process.env.PORCELAIN_HOME

const excludePath = (repo: string): string => join(repo, '.git', 'info', 'exclude')

/** What the daemon's `hideCompanion` leaves behind on first companion write. */
function seedHiddenCompanion(repo: string): void {
  mkdirSync(join(repo, '.git', 'info'), { recursive: true })
  writeFileSync(
    excludePath(repo),
    '# a rule the human wrote\nnotes.local\n# Porcelain companion — hidden from git in this clone only.\n.porcelain/\n',
  )
}

function seedInventory(project: { id: string; worktrees: Array<{ id: string; gitDir: string }> }) {
  const commonGitDir = realpathSync(join(repoPath, '.git'))
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: project.id,
            commonGitDir,
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees: project.worktrees,
          },
        ],
      },
    }),
  )
}

const indexPath = (): string => join(homeDir, 'projects', 'proj-1', 'canvases', 'index.json')
const readIndexRecords = (): CanvasRecord[] => {
  const raw = JSON.parse(readFileSync(indexPath(), 'utf8')) as {
    value: { canvases: CanvasRecord[] }
  }
  return raw.value.canvases
}
const gitStatus = (repo: string): string =>
  // -uall: git collapses an untracked directory to one line otherwise, which
  // would pass even if only an ignored sibling were showing.
  execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: repo, encoding: 'utf8' })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-overlay-cli-'))
  repoPath = join(root, 'repo')
  otherRepo = join(root, 'other')
  homeDir = join(root, 'home')
  sourceDir = join(root, 'source')
  for (const dir of [repoPath, otherRepo, sourceDir]) mkdirSync(dir, { recursive: true })
  for (const repo of [repoPath, otherRepo]) {
    execFileSync('git', ['init', '--initial-branch=main'], { cwd: repo })
    seedHiddenCompanion(repo)
  }
  writeFileSync(join(sourceDir, 'index.html'), '<p>hi</p>')
  writeFileSync(join(sourceDir, 'shot.png'), 'fake-png')
  process.env.PORCELAIN_HOME = homeDir
  seedInventory({
    id: 'proj-1',
    worktrees: [{ id: 'wt-1', gitDir: realpathSync(join(repoPath, '.git')) }],
  })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})

describe('revealCompanionOverlay', () => {
  it('rewrites the hidden companion line into the overlay-visible form, keeping other rules', () => {
    expect(revealCompanionOverlay(repoPath)).toBe(true)
    const lines = readFileSync(excludePath(repoPath), 'utf8').trim().split('\n')
    expect(lines).toEqual([
      '# a rule the human wrote',
      'notes.local',
      '# Porcelain companion — hidden from git in this clone only.',
      '.porcelain/*',
      '!.porcelain/canvases/',
      '!.porcelain/project.json',
    ])
  })

  it('is idempotent once the overlay lines are in place', () => {
    expect(revealCompanionOverlay(repoPath)).toBe(true)
    const after = readFileSync(excludePath(repoPath), 'utf8')
    expect(revealCompanionOverlay(repoPath)).toBe(false)
    expect(readFileSync(excludePath(repoPath), 'utf8')).toBe(after)
  })

  it('leaves a repo that never hid its companion completely alone', () => {
    writeFileSync(excludePath(repoPath), 'notes.local\n')
    expect(revealCompanionOverlay(repoPath)).toBe(false)
    expect(readFileSync(excludePath(repoPath), 'utf8')).toBe('notes.local\n')
  })

  it('does nothing outside a git repository', () => {
    expect(revealCompanionOverlay(join(root, 'source'))).toBe(false)
  })
})

describe('promoteCanvas', () => {
  it('moves the bundle into the overlay and drops the private copy and its index record', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })
    const privateBundle = join(homeDir, 'projects', 'proj-1', 'canvases', record.id)
    expect(existsSync(privateBundle)).toBe(true)

    const promoted = promoteCanvas({ repoPath, id: record.id })

    expect(promoted.bundlePath).toBe(join(repoPath, '.porcelain', 'canvases', record.id))
    expect(readFileSync(join(promoted.bundlePath, 'index.html'), 'utf8')).toBe('<p>hi</p>')
    expect(readFileSync(join(promoted.bundlePath, 'shot.png'), 'utf8')).toBe('fake-png')
    // The move half: never two editable copies of one Canvas.
    expect(existsSync(privateBundle)).toBe(false)
    expect(readIndexRecords()).toEqual([])
  })

  it('writes a tracked manifest with worktreeId null and an id matching the directory', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })
    expect(record.worktreeId).toBe('wt-1')

    const { bundlePath } = promoteCanvas({ repoPath, id: record.id })

    const manifest = JSON.parse(
      readFileSync(join(bundlePath, 'canvas.json'), 'utf8'),
    ) as CanvasRecord
    expect(manifest).toEqual({
      id: record.id,
      worktreeId: null,
      title: 'Intent',
      kind: 'html',
      entryFile: 'index.html',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
    expect(manifest.id).toBe(bundlePath.split('/').at(-1))
  })

  it('leaves the promoted bundle visible to git while the rest of the companion stays hidden', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })
    expect(gitStatus(repoPath)).toBe('')

    promoteCanvas({ repoPath, id: record.id })

    const status = gitStatus(repoPath)
    expect(status).toContain('.porcelain/canvases/')
    expect(status).not.toContain('scope.json')
  })

  it('promotes into an explicit --worktree target rather than the resolved repo', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })

    const { bundlePath } = promoteCanvas({ repoPath, id: record.id, worktreePath: otherRepo })

    expect(bundlePath).toBe(join(otherRepo, '.porcelain', 'canvases', record.id))
    expect(existsSync(join(repoPath, '.porcelain', 'canvases', record.id))).toBe(false)
    expect(gitStatus(otherRepo)).toContain('.porcelain/canvases/')
  })

  it('refuses an id that is not a private Canvas of this Project', () => {
    expect(() => promoteCanvas({ repoPath, id: 'nope' })).toThrow(/no private Canvas nope/)
  })

  it('refuses a --worktree that is not an existing directory', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })
    expect(() =>
      promoteCanvas({ repoPath, id: record.id, worktreePath: join(root, 'missing') }),
    ).toThrow(/not an existing directory/)
    // The private copy survives a refused promotion.
    expect(readIndexRecords().map((c) => c.id)).toEqual([record.id])
  })

  it('rejects a relative --worktree path', () => {
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })
    expect(() => promoteCanvas({ repoPath, id: record.id, worktreePath: 'other' })).toThrow(
      /must be an absolute path/,
    )
  })
})

describe('setCanvas --tracked', () => {
  it('writes the tracked path and leaves the daemon-root index untouched', () => {
    const record = setCanvas({ repoPath, title: 'Docs', kind: 'html', sourceDir, tracked: true })

    const bundle = join(repoPath, '.porcelain', 'canvases', record.id)
    expect(readFileSync(join(bundle, 'index.html'), 'utf8')).toBe('<p>hi</p>')
    expect(record.worktreeId).toBe(null)
    expect(existsSync(indexPath())).toBe(false)
    expect(existsSync(join(homeDir, 'projects', 'proj-1', 'canvases', record.id))).toBe(false)
    expect(gitStatus(repoPath)).toContain('.porcelain/canvases/')
  })

  it('replaces an existing tracked Canvas by id, preserving createdAt', async () => {
    const first = setCanvas({ repoPath, title: 'Docs', kind: 'html', sourceDir, tracked: true })
    await new Promise((r) => setTimeout(r, 2))
    writeFileSync(join(sourceDir, 'index.html'), '<p>v2</p>')

    const second = setCanvas({
      repoPath,
      title: 'Docs v2',
      kind: 'html',
      sourceDir,
      tracked: true,
      id: first.id,
    })

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).not.toBe(first.updatedAt)
    const bundle = join(repoPath, '.porcelain', 'canvases', first.id)
    expect(readFileSync(join(bundle, 'index.html'), 'utf8')).toBe('<p>v2</p>')
    const manifest = JSON.parse(readFileSync(join(bundle, 'canvas.json'), 'utf8')) as CanvasRecord
    expect(manifest.title).toBe('Docs v2')
  })

  it('refuses an --id that is not already a tracked Canvas', () => {
    setCanvas({ repoPath, title: 'Docs', kind: 'html', sourceDir, tracked: true })
    expect(() =>
      setCanvas({ repoPath, title: 'Docs', kind: 'html', sourceDir, tracked: true, id: 'nope' }),
    ).toThrow(/no tracked Canvas nope/)
  })
})

describe('promoteOverrides', () => {
  it('promotes explicit hide/pin paths as repo-relative paths', () => {
    const overrides = promoteOverrides(repoPath, {
      hidden: ['apps/legacy'],
      pinned: [join(repoPath, 'apps/web')],
    })

    expect(overrides).toEqual({
      hiddenPaths: ['apps/legacy'],
      pinnedPaths: ['apps/web'],
      worktrees: {},
    })
    const onDisk = JSON.parse(
      readFileSync(join(repoPath, '.porcelain', 'project.json'), 'utf8'),
    ) as unknown
    expect(onDisk).toEqual(overrides)
    expect(gitStatus(repoPath)).toContain('.porcelain/project.json')
  })

  it('adds extra paths without dropping the promoted scope, and dedupes', () => {
    const overrides = promoteOverrides(repoPath, {
      hidden: ['apps/legacy', 'docs/old'],
      pinned: ['apps/web'],
    })

    expect(overrides.hiddenPaths).toEqual(['apps/legacy', 'docs/old'])
    expect(overrides.pinnedPaths).toEqual(['apps/web'])
  })

  it('carries existing worktree setup entries through a re-promotion', () => {
    mkdirSync(join(repoPath, '.porcelain'), { recursive: true })
    writeFileSync(
      join(repoPath, '.porcelain', 'project.json'),
      JSON.stringify({
        hiddenPaths: [],
        pinnedPaths: [],
        worktrees: { main: { setup: { startScript: 'pnpm i', disposeScript: 'rm -rf out' } } },
      }),
    )
    const overrides = promoteOverrides(repoPath, { hidden: ['apps/legacy'] })

    expect(overrides.worktrees).toEqual({
      main: { setup: { startScript: 'pnpm i', disposeScript: 'rm -rf out' } },
    })
    expect(readOverrides(repoPath)).toEqual(overrides)
  })

  it('reads an absent project.json as empty', () => {
    expect(readOverrides(repoPath)).toEqual({ hiddenPaths: [], pinnedPaths: [], worktrees: {} })
  })
})

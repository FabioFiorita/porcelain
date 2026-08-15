import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type CanvasRecord,
  describeCanvases,
  listCanvasesForRepo,
  resolveHubIdentity,
  setCanvas,
} from './canvas-file'

let root = ''
let repoPath = ''
let homeDir = ''
let sourceDir = ''
const prevHome = process.env.PORCELAIN_HOME

function seedInventory(project: {
  id: string
  worktrees: Array<{ id: string; gitDir: string }>
}): void {
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

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-canvas-cli-'))
  repoPath = join(root, 'repo')
  homeDir = join(root, 'home')
  sourceDir = join(root, 'source')
  mkdirSync(repoPath, { recursive: true })
  mkdirSync(sourceDir, { recursive: true })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoPath })
  process.env.PORCELAIN_HOME = homeDir
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})

describe('resolveHubIdentity', () => {
  it('throws when no Hub inventory exists yet', () => {
    expect(() => resolveHubIdentity(repoPath)).toThrow(/no Hub inventory yet/)
  })

  it('throws when the inventory has no matching Project', () => {
    seedInventory({ id: 'proj-other', worktrees: [] })
    // Point it at some unrelated git dir so this repo's commonGitDir never matches.
    writeFileSync(
      join(homeDir, 'hub-inventory.json'),
      JSON.stringify({
        version: 1,
        value: {
          projects: [
            {
              id: 'proj-other',
              commonGitDir: '/somewhere/else/.git',
              groupingKey: 'name:other',
              name: 'other',
              worktrees: [],
            },
          ],
        },
      }),
    )
    expect(() => resolveHubIdentity(repoPath)).toThrow(/not registered with a Porcelain/)
  })

  it('resolves the Project and Worktree id from a matching inventory', () => {
    const gitDir = realpathSync(join(repoPath, '.git'))
    seedInventory({ id: 'proj-1', worktrees: [{ id: 'wt-1', gitDir }] })
    expect(resolveHubIdentity(repoPath)).toEqual({ projectId: 'proj-1', worktreeId: 'wt-1' })
  })

  it('resolves a null worktreeId when the Project is known but this Worktree is not', () => {
    seedInventory({ id: 'proj-1', worktrees: [] })
    expect(resolveHubIdentity(repoPath)).toEqual({ projectId: 'proj-1', worktreeId: null })
  })
})

describe('setCanvas', () => {
  beforeEach(() => {
    const gitDir = realpathSync(join(repoPath, '.git'))
    seedInventory({ id: 'proj-1', worktrees: [{ id: 'wt-1', gitDir }] })
  })

  it('rejects a relative --source-dir', () => {
    expect(() =>
      setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir: 'relative/dir' }),
    ).toThrow(/absolute/)
  })

  it('rejects a source dir missing the default entry file', () => {
    expect(() => setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })).toThrow(
      /entry file not found/,
    )
  })

  it('creates a new Canvas, copying the source dir into the bundle and writing the manifest', () => {
    writeFileSync(join(sourceDir, 'index.html'), '<p>hi</p>')
    writeFileSync(join(sourceDir, 'shot.png'), 'fake-png')

    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })

    expect(record.title).toBe('Intent')
    expect(record.kind).toBe('html')
    expect(record.entryFile).toBe('index.html')
    expect(record.worktreeId).toBe('wt-1')
    expect(record.createdAt).toBe(record.updatedAt)

    const bundleDir = join(homeDir, 'projects', 'proj-1', 'canvases', record.id)
    expect(readFileSync(join(bundleDir, 'index.html'), 'utf8')).toBe('<p>hi</p>')
    expect(readFileSync(join(bundleDir, 'shot.png'), 'utf8')).toBe('fake-png')

    const manifest = JSON.parse(
      readFileSync(join(homeDir, 'projects', 'proj-1', 'canvases', 'index.json'), 'utf8'),
    ) as { value: { canvases: CanvasRecord[] } }
    expect(manifest.value.canvases).toEqual([record])
  })

  it('honours a custom --entry file name', () => {
    writeFileSync(join(sourceDir, 'notes.md'), '# hi')
    const record = setCanvas({
      repoPath,
      title: 'Notes',
      kind: 'markdown',
      sourceDir,
      entryFile: 'notes.md',
    })
    expect(record.entryFile).toBe('notes.md')
  })

  it('rejects an --entry that escapes --source-dir', () => {
    writeFileSync(join(sourceDir, 'index.html'), '<p>hi</p>')
    expect(() =>
      setCanvas({
        repoPath,
        title: 'Intent',
        kind: 'html',
        sourceDir,
        entryFile: '../../etc/passwd',
      }),
    ).toThrow(/must resolve inside/)
  })

  it('replaces an existing Canvas bundle wholesale when --id matches, preserving createdAt', async () => {
    writeFileSync(join(sourceDir, 'index.html'), '<p>v1</p>')
    const first = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })

    await new Promise((r) => setTimeout(r, 2))
    writeFileSync(join(sourceDir, 'index.html'), '<p>v2</p>')
    const second = setCanvas({
      repoPath,
      title: 'Intent v2',
      kind: 'html',
      sourceDir,
      id: first.id,
    })

    expect(second.id).toBe(first.id)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).not.toBe(first.updatedAt)
    expect(second.title).toBe('Intent v2')

    const bundleDir = join(homeDir, 'projects', 'proj-1', 'canvases', first.id)
    expect(readFileSync(join(bundleDir, 'index.html'), 'utf8')).toBe('<p>v2</p>')

    const manifest = JSON.parse(
      readFileSync(join(homeDir, 'projects', 'proj-1', 'canvases', 'index.json'), 'utf8'),
    ) as { value: { canvases: CanvasRecord[] } }
    expect(manifest.value.canvases).toEqual([second])
  })

  it('throws when --id names a Canvas that does not exist', () => {
    writeFileSync(join(sourceDir, 'index.html'), '<p>hi</p>')
    expect(() =>
      setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir, id: 'nope' }),
    ).toThrow(/no Canvas nope/)
  })
})

describe('listCanvasesForRepo + describeCanvases', () => {
  it('describes an empty Project', () => {
    const gitDir = realpathSync(join(repoPath, '.git'))
    seedInventory({ id: 'proj-1', worktrees: [{ id: 'wt-1', gitDir }] })
    expect(describeCanvases(listCanvasesForRepo(repoPath))).toContain('No Canvases')
  })

  it('lists a Canvas created through setCanvas', () => {
    const gitDir = realpathSync(join(repoPath, '.git'))
    seedInventory({ id: 'proj-1', worktrees: [{ id: 'wt-1', gitDir }] })
    writeFileSync(join(sourceDir, 'index.html'), '<p>hi</p>')
    const record = setCanvas({ repoPath, title: 'Intent', kind: 'html', sourceDir })

    const listed = listCanvasesForRepo(repoPath)
    expect(listed).toEqual([record])
    expect(describeCanvases(listed)).toContain('Intent')
  })
})

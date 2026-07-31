import { execFileSync } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addAction, readActions } from './actions-store'
import { addCard, readCards } from './board-store'
import { addComment, readComments } from './comment-store'
import { gitEnv } from './git-env'
import { readLayers, writeLayers } from './layers-store'
import { readNotes, writeNotes } from './notes-store'
import {
  copyRepoSettings,
  exportRepoSettings,
  importRepoSettings,
  seedRepoSettings,
  seedWorktreeSettings,
} from './repo-settings'

const SRC = '/Users/me/Code/my-project'
const DST = '/home/me/code/my-project'

describe('repo-settings export/import/copy', () => {
  let dir: string
  let prevEnv: Record<string, string | undefined>

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'porcelain-settings-'))
    prevEnv = {
      PORCELAIN_ACTIONS: process.env.PORCELAIN_ACTIONS,
      PORCELAIN_BOARD: process.env.PORCELAIN_BOARD,
      PORCELAIN_NOTES: process.env.PORCELAIN_NOTES,
      PORCELAIN_LAYERS: process.env.PORCELAIN_LAYERS,
      PORCELAIN_COMMENTS: process.env.PORCELAIN_COMMENTS,
    }
    process.env.PORCELAIN_ACTIONS = join(dir, 'actions.json')
    process.env.PORCELAIN_BOARD = join(dir, 'board.json')
    process.env.PORCELAIN_NOTES = join(dir, 'notes.json')
    process.env.PORCELAIN_LAYERS = join(dir, 'layers.json')
    process.env.PORCELAIN_COMMENTS = join(dir, 'comments.json')
  })

  afterEach(async () => {
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(dir, { recursive: true, force: true })
  })

  it('exports only non-empty channels', async () => {
    expect(await exportRepoSettings(SRC)).toEqual({})
    await writeNotes(SRC, '# hello')
    expect(await exportRepoSettings(SRC)).toEqual({ notes: '# hello' })
  })

  it('imports a snapshot onto a new path key (replace, not merge)', async () => {
    await addAction(SRC, { title: 'Dev', command: 'pnpm dev' })
    await writeNotes(SRC, 'Mac notes')
    await addCard(SRC, { title: 'Ship it', status: 'todo' })
    await writeLayers(SRC, [{ label: 'UI', pattern: 'src/renderer' }])
    await addComment(SRC, { path: 'src/app.ts', body: 'check this', startLine: 1, endLine: 1 })

    const snapshot = await exportRepoSettings(SRC)
    const result = await importRepoSettings(DST, snapshot)
    expect(result.imported.sort()).toEqual(['actions', 'board', 'comments', 'layers', 'notes'])

    expect(await readNotes(DST)).toBe('Mac notes')
    expect(await readActions(DST)).toHaveLength(1)
    expect((await readActions(DST))[0]?.title).toBe('Dev')
    expect(await readCards(DST)).toHaveLength(1)
    expect(await readLayers(DST)).toEqual([{ label: 'UI', pattern: 'src/renderer' }])
    expect(await readComments(DST)).toHaveLength(1)
    expect((await readComments(DST))[0]?.body).toBe('check this')
    // Source untouched.
    expect(await readNotes(SRC)).toBe('Mac notes')
  })

  it('copyRepoSettings remaps path keys on the same host', async () => {
    await writeNotes(SRC, 'carry me')
    await addAction(SRC, { title: 'Test', command: 'pnpm test' })
    const result = await copyRepoSettings(SRC, DST)
    expect(result.imported).toContain('notes')
    expect(result.imported).toContain('actions')
    expect(await readNotes(DST)).toBe('carry me')
    expect(await readActions(DST)).toHaveLength(1)
  })

  it('copyRepoSettings is a no-op when paths match', async () => {
    await writeNotes(SRC, 'x')
    expect(await copyRepoSettings(SRC, SRC)).toEqual({ imported: [] })
  })

  it('import leaves absent channels alone on the target', async () => {
    await writeNotes(DST, 'keep me')
    await importRepoSettings(DST, { actions: [] })
    expect(await readNotes(DST)).toBe('keep me')
    expect(await readActions(DST)).toEqual([])
  })

  it('seedRepoSettings fills an empty target', async () => {
    await writeNotes(SRC, 'seed me')
    expect((await seedRepoSettings(SRC, DST)).imported).toEqual(['notes'])
    expect(await readNotes(DST)).toBe('seed me')
  })

  it('seedRepoSettings never overwrites a target that already has settings', async () => {
    await writeNotes(SRC, 'source notes')
    await writeNotes(DST, 'mine')
    expect(await seedRepoSettings(SRC, DST)).toEqual({ imported: [] })
    expect(await readNotes(DST)).toBe('mine')
  })

  it('seedRepoSettings is a no-op when the paths match', async () => {
    await writeNotes(SRC, 'x')
    expect(await seedRepoSettings(SRC, SRC)).toEqual({ imported: [] })
  })
})

describe('seedWorktreeSettings', () => {
  const dirs: string[] = []
  let prevEnv: Record<string, string | undefined>

  function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, {
      // gitEnv, not a bare process.env: an inherited GIT_DIR would override `cwd`
      // and point every fixture command at the real repository.
      env: gitEnv(process.env, {
        GIT_AUTHOR_NAME: 'Test User',
        GIT_AUTHOR_EMAIL: 'test@porcelain.test',
        GIT_COMMITTER_NAME: 'Test User',
        GIT_COMMITTER_EMAIL: 'test@porcelain.test',
      }),
      cwd,
      stdio: 'pipe',
    }).toString()
  }

  async function repoWithWorktree(): Promise<{ primary: string; worktree: string }> {
    const primary = await mkdtemp(join(tmpdir(), 'porcelain-seed-'))
    const worktree = join(dirname(primary), `${basename(primary)}-worktrees`, 'feature')
    dirs.push(primary, dirname(worktree))
    git(primary, 'init', '-b', 'main')
    git(primary, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'root')
    git(primary, 'worktree', 'add', '-b', 'feature', worktree)
    // git realpath-resolves the paths it records, and the channels are keyed by the
    // path the app passes — resolve both so the two agree (macOS /var → /private/var).
    return { primary: await realpath(primary), worktree: await realpath(worktree) }
  }

  beforeEach(async () => {
    const home = await mkdtemp(join(tmpdir(), 'porcelain-seed-home-'))
    dirs.push(home)
    // Every channel exportRepoSettings touches is redirected — the seed reads them all.
    prevEnv = {
      PORCELAIN_ACTIONS: process.env.PORCELAIN_ACTIONS,
      PORCELAIN_BOARD: process.env.PORCELAIN_BOARD,
      PORCELAIN_NOTES: process.env.PORCELAIN_NOTES,
      PORCELAIN_LAYERS: process.env.PORCELAIN_LAYERS,
      PORCELAIN_COMMENTS: process.env.PORCELAIN_COMMENTS,
      PORCELAIN_SCOPE: process.env.PORCELAIN_SCOPE,
    }
    process.env.PORCELAIN_ACTIONS = join(home, 'actions.json')
    process.env.PORCELAIN_BOARD = join(home, 'board.json')
    process.env.PORCELAIN_NOTES = join(home, 'notes.json')
    process.env.PORCELAIN_LAYERS = join(home, 'layers.json')
    process.env.PORCELAIN_COMMENTS = join(home, 'comments.json')
    process.env.PORCELAIN_SCOPE = join(home, 'scope.json')
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(prevEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
  })

  it('seeds a worktree from its primary checkout on first open', async () => {
    const { primary, worktree } = await repoWithWorktree()
    await writeNotes(primary, 'project notes')
    await addAction(primary, { title: 'Dev', command: 'pnpm dev' })

    const result = await seedWorktreeSettings(worktree)

    expect(result.imported.sort()).toEqual(['actions', 'notes'])
    expect(await readNotes(worktree)).toBe('project notes')
    expect(await readActions(worktree)).toHaveLength(1)
  })

  it('leaves a worktree that already has settings untouched', async () => {
    const { primary, worktree } = await repoWithWorktree()
    await writeNotes(primary, 'project notes')
    await writeNotes(worktree, 'worktree notes')

    expect(await seedWorktreeSettings(worktree)).toEqual({ imported: [] })
    expect(await readNotes(worktree)).toBe('worktree notes')
  })

  it('does nothing for a primary checkout (never seeds a repo from itself)', async () => {
    const { primary } = await repoWithWorktree()
    await writeNotes(primary, 'project notes')
    expect(await seedWorktreeSettings(primary)).toEqual({ imported: [] })
  })

  it('is silent when the family cannot be resolved (broken .git pointer)', async () => {
    const orphan = await mkdtemp(join(tmpdir(), 'porcelain-orphan-'))
    dirs.push(orphan)
    await writeFile(join(orphan, '.git'), 'gitdir: /nowhere/does/not/exist\n')
    expect(await seedWorktreeSettings(orphan)).toEqual({ imported: [] })
  })
})

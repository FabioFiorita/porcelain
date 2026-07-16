import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addAction, readActions } from './actions-store'
import { addCard, readCards } from './board-store'
import { addComment, readComments } from './comment-store'
import { readLayers, writeLayers } from './layers-store'
import { readNotes, writeNotes } from './notes-store'
import { copyRepoSettings, exportRepoSettings, importRepoSettings } from './repo-settings'

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
})

import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateNotesFromConfig, readNotes, writeNotes } from './notes-store'

// config-store imports electron (no real module under vitest), and the migration
// reads it — mock it so we control the legacy config without booting electron.
const { loadConfig } = vi.hoisted(() => ({ loadConfig: vi.fn() }))
vi.mock('./config-store', () => ({ loadConfig }))

const dir = join(tmpdir(), 'porcelain-notes-store-test')
const file = join(dir, 'notes.json')

beforeEach(() => {
  process.env.PORCELAIN_NOTES = file
  rmSync(dir, { recursive: true, force: true })
  loadConfig.mockReset()
})
afterEach(() => {
  delete process.env.PORCELAIN_NOTES
  rmSync(dir, { recursive: true, force: true })
})

describe('notes-store', () => {
  it('writes notes and reads them back', async () => {
    await writeNotes('/repo', '# todo\n- ship it')
    expect(await readNotes('/repo')).toBe('# todo\n- ship it')
  })

  it('returns an empty string for a repo with no notes', async () => {
    expect(await readNotes('/repo')).toBe('')
  })

  it('keeps repos isolated', async () => {
    await writeNotes('/r1', 'one')
    await writeNotes('/r2', 'two')
    expect(await readNotes('/r1')).toBe('one')
    expect(await readNotes('/r2')).toBe('two')
  })

  it('drops the entry when notes are cleared to empty', async () => {
    await writeNotes('/repo', 'hi')
    await writeNotes('/repo', '')
    expect(await readNotes('/repo')).toBe('')
  })
})

describe('migrateNotesFromConfig', () => {
  it('copies legacy config notes into the notes channel', async () => {
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: [], notes: 'legacy' } },
    })
    await migrateNotesFromConfig()
    expect(await readNotes('/repo')).toBe('legacy')
  })

  it('never clobbers a newer in-app edit already in the channel', async () => {
    await writeNotes('/repo', 'new')
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: [], notes: 'old' } },
    })
    await migrateNotesFromConfig()
    expect(await readNotes('/repo')).toBe('new')
  })

  it('no-ops when no repo has legacy notes', async () => {
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: [] } },
    })
    await migrateNotesFromConfig()
    expect(await readNotes('/repo')).toBe('')
  })
})

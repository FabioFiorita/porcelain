import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readNotes, writeNotes } from './notes-store'

const dir = join(tmpdir(), 'porcelain-notes-store-test')
const file = join(dir, 'notes.json')

beforeEach(() => {
  process.env.PORCELAIN_NOTES = file
  rmSync(dir, { recursive: true, force: true })
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

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeNotes, readNotes } from './notes-file'

const dir = join(tmpdir(), 'porcelain-notes-file-test')
const file = join(dir, 'notes.json')

beforeEach(() => {
  process.env.PORCELAIN_NOTES = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_NOTES
  rmSync(dir, { recursive: true, force: true })
})

function seed(notes: Record<string, unknown>): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(notes))
}

describe('notes-file', () => {
  it('reads a repo-keyed markdown string', () => {
    seed({ '/repo': '# todo\n- ship it' })
    expect(readNotes('/repo')).toBe('# todo\n- ship it')
  })

  it('returns an empty string when the file or repo entry is absent', () => {
    expect(readNotes('/repo')).toBe('')
    seed({ '/other': 'hi' })
    expect(readNotes('/repo')).toBe('')
  })

  it('skips non-string values rather than throwing', () => {
    seed({ '/repo': 42, '/ok': 'real' })
    expect(readNotes('/repo')).toBe('')
    expect(readNotes('/ok')).toBe('real')
  })

  it('describes the notes verbatim with a header', () => {
    expect(describeNotes('/repo', '# todo')).toContain('# todo')
    expect(describeNotes('/repo', '# todo')).toContain('/repo')
  })

  it('describes an empty scratchpad with a hint, not a header', () => {
    const text = describeNotes('/repo', '   \n  ')
    expect(text).toContain('No project notes for /repo')
  })
})

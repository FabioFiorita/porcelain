import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeNotes, readNotes } from './notes-file'

const root = join(tmpdir(), 'porcelain-notes-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('notes-file', () => {
  it('reads markdown from .porcelain/notes.md', () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(projectPorcelainPath(repo, PROJECT_FILES.notes), '# todo\n- ship it')
    expect(readNotes(repo)).toBe('# todo\n- ship it')
  })

  it('returns an empty string when absent', () => {
    expect(readNotes(repo)).toBe('')
  })

  it('describes the notes verbatim with a header', () => {
    expect(describeNotes(repo, '# todo')).toContain('# todo')
    expect(describeNotes(repo, '# todo')).toContain(repo)
  })

  it('describes an empty scratchpad with a hint', () => {
    const text = describeNotes(repo, '   \n  ')
    expect(text).toContain('No project notes')
  })
})

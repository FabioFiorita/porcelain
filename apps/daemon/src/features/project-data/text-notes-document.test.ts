// @vitest-environment node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createTextNotesDocument } from './text-notes-document'

const notesPath = (repo: string): string => projectPorcelainPath(repo, PROJECT_FILES.notes)

describe('text notes document', () => {
  it('writes notes and reads them back', async () => {
    await withTemporaryDirectory('porcelain-notes-roundtrip-', async (repo) => {
      const notes = createTextNotesDocument()
      await notes.write(repo, '# todo\n- ship it')
      expect(await notes.read(repo)).toBe('# todo\n- ship it')
    })
  })

  it('returns an empty string for a repo with no notes', async () => {
    await withTemporaryDirectory('porcelain-notes-missing-', async (repo) => {
      const notes = createTextNotesDocument()
      expect(await notes.read(repo)).toBe('')
    })
  })

  it('keeps repos isolated', async () => {
    await withTemporaryDirectory('porcelain-notes-isolated-', async (root) => {
      const r1 = join(root, 'r1')
      const r2 = join(root, 'r2')
      await mkdir(r1, { recursive: true })
      await mkdir(r2, { recursive: true })
      const notes = createTextNotesDocument()
      await notes.write(r1, 'one')
      await notes.write(r2, 'two')
      expect(await notes.read(r1)).toBe('one')
      expect(await notes.read(r2)).toBe('two')
    })
  })

  it('unlinks notes.md when notes are cleared to empty', async () => {
    await withTemporaryDirectory('porcelain-notes-unlink-', async (repo) => {
      const notes = createTextNotesDocument()
      await notes.write(repo, 'hi')
      await notes.write(repo, '')
      expect(await notes.read(repo)).toBe('')
      await expect(access(notesPath(repo))).rejects.toMatchObject({ code: 'ENOENT' })
    })
  })

  it('round-trips existing unversioned notes.md bytes without a version envelope', async () => {
    await withTemporaryDirectory('porcelain-notes-unversioned-', async (repo) => {
      await mkdir(join(repo, '.porcelain'), { recursive: true })
      const bytes = '# already here\n\nDo not wrap me.\n'
      await writeFile(notesPath(repo), bytes)
      const notes = createTextNotesDocument()
      expect(await notes.read(repo)).toBe(bytes)
      await notes.write(repo, bytes)
      expect(await readFile(notesPath(repo), 'utf8')).toBe(bytes)
      expect(bytes.startsWith('{')).toBe(false)
    })
  })
})

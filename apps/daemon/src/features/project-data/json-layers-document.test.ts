// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { createJsonLayersDocument } from './json-layers-document'

const layers = [
  { label: 'Pages', pattern: '(^|/)pages/' },
  { label: 'Data', pattern: '(^|/)models?/' },
]

const layersPath = (repo: string): string => projectPorcelainPath(repo, PROJECT_FILES.layers)

describe('json layers document', () => {
  it('writes layers and reads them back in order', async () => {
    await withTemporaryDirectory('porcelain-layers-roundtrip-', async (repo) => {
      const document = createJsonLayersDocument()
      await document.write(repo, layers)
      expect(await document.read(repo)).toEqual(layers)
    })
  })

  it('returns null for a repo with no custom layers', async () => {
    await withTemporaryDirectory('porcelain-layers-missing-', async (repo) => {
      const document = createJsonLayersDocument()
      expect(await document.read(repo)).toBeNull()
    })
  })

  it('keeps repos isolated', async () => {
    await withTemporaryDirectory('porcelain-layers-isolated-', async (root) => {
      const r1 = join(root, 'r1')
      const r2 = join(root, 'r2')
      await mkdir(r1, { recursive: true })
      await mkdir(r2, { recursive: true })
      const document = createJsonLayersDocument()
      await document.write(r1, [{ label: 'A', pattern: '(^|/)a/' }])
      await document.write(r2, [{ label: 'B', pattern: '(^|/)b/' }])
      expect(await document.read(r1)).toEqual([{ label: 'A', pattern: '(^|/)a/' }])
      expect(await document.read(r2)).toEqual([{ label: 'B', pattern: '(^|/)b/' }])
    })
  })

  it('clears the override back to defaults (null drops the entry)', async () => {
    await withTemporaryDirectory('porcelain-layers-clear-', async (repo) => {
      const document = createJsonLayersDocument()
      await document.write(repo, layers)
      await document.write(repo, null)
      expect(await document.read(repo)).toBeNull()
    })
  })

  it('drops uncompilable patterns on read so flow grouping never throws', async () => {
    await withTemporaryDirectory('porcelain-layers-drop-', async (repo) => {
      await mkdir(join(repo, '.porcelain'), { recursive: true })
      await writeFile(
        layersPath(repo),
        JSON.stringify([
          { label: 'Good', pattern: '(^|/)ok/' },
          { label: 'Bad', pattern: '(' },
          { label: 'Empty', pattern: '' },
        ]),
      )
      const document = createJsonLayersDocument()
      expect(await document.read(repo)).toEqual([{ label: 'Good', pattern: '(^|/)ok/' }])
    })
  })

  it('treats a repo whose layers all drop as having none', async () => {
    await withTemporaryDirectory('porcelain-layers-all-invalid-', async (repo) => {
      await mkdir(join(repo, '.porcelain'), { recursive: true })
      await writeFile(layersPath(repo), JSON.stringify([{ label: 'Bad', pattern: '(' }]))
      const document = createJsonLayersDocument()
      expect(await document.read(repo)).toBeNull()
    })
  })

  it('round-trips existing unversioned layers.json bytes without a version envelope', async () => {
    await withTemporaryDirectory('porcelain-layers-unversioned-', async (repo) => {
      await mkdir(join(repo, '.porcelain'), { recursive: true })
      const bytes = `${JSON.stringify(layers, null, 2)}\n`
      await writeFile(layersPath(repo), bytes)
      const document = createJsonLayersDocument()
      expect(await document.read(repo)).toEqual(layers)
      const raw = JSON.parse(await readFile(layersPath(repo), 'utf8'))
      expect(raw).toEqual(layers)
      expect(raw).not.toHaveProperty('version')
    })
  })

  it('treats a DAT-001 envelope as unparseable and reads as null', async () => {
    await withTemporaryDirectory('porcelain-layers-envelope-', async (repo) => {
      await mkdir(join(repo, '.porcelain'), { recursive: true })
      await writeFile(
        layersPath(repo),
        JSON.stringify({ version: 1, value: [{ label: 'Pages', pattern: '(^|/)pages/' }] }),
      )
      const document = createJsonLayersDocument()
      expect(await document.read(repo)).toBeNull()
    })
  })
})

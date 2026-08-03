import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readLayers, writeLayers } from './layers-store'

const root = join(tmpdir(), 'porcelain-layers-store-test')
const repo = join(root, 'repo')
const layers = [
  { label: 'Pages', pattern: '(^|/)pages/' },
  { label: 'Data', pattern: '(^|/)models?/' },
]

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('layers-store', () => {
  it('writes layers and reads them back in order', async () => {
    await writeLayers(repo, layers)
    expect(await readLayers(repo)).toEqual(layers)
  })

  it('returns null for a repo with no custom layers', async () => {
    expect(await readLayers(repo)).toBeNull()
  })

  it('keeps repos isolated', async () => {
    const r1 = join(root, 'r1')
    const r2 = join(root, 'r2')
    mkdirSync(r1, { recursive: true })
    mkdirSync(r2, { recursive: true })
    await writeLayers(r1, [{ label: 'A', pattern: '(^|/)a/' }])
    await writeLayers(r2, [{ label: 'B', pattern: '(^|/)b/' }])
    expect(await readLayers(r1)).toEqual([{ label: 'A', pattern: '(^|/)a/' }])
    expect(await readLayers(r2)).toEqual([{ label: 'B', pattern: '(^|/)b/' }])
  })

  it('clears the override back to defaults (null drops the entry)', async () => {
    await writeLayers(repo, layers)
    await writeLayers(repo, null)
    expect(await readLayers(repo)).toBeNull()
  })

  it('drops uncompilable patterns on read so flow grouping never throws', async () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, PROJECT_FILES.layers),
      JSON.stringify([
        { label: 'Good', pattern: '(^|/)ok/' },
        { label: 'Bad', pattern: '(' },
        { label: 'Empty', pattern: '' },
      ]),
    )
    expect(await readLayers(repo)).toEqual([{ label: 'Good', pattern: '(^|/)ok/' }])
  })

  it('treats a repo whose layers all drop as having none', async () => {
    mkdirSync(join(repo, '.porcelain'), { recursive: true })
    writeFileSync(
      projectPorcelainPath(repo, PROJECT_FILES.layers),
      JSON.stringify([{ label: 'Bad', pattern: '(' }]),
    )
    expect(await readLayers(repo)).toBeNull()
  })
})

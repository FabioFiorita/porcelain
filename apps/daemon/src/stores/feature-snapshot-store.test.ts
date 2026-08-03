import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  featureSnapshotPath,
  readFeatureSnapshot,
  writeFeatureSnapshot,
} from './feature-snapshot-store'

const root = join(tmpdir(), 'porcelain-feature-snapshot-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('feature snapshot store', () => {
  it('paths under project .porcelain', () => {
    expect(featureSnapshotPath(repo)).toBe(projectPorcelainPath(repo, PROJECT_FILES.featureView))
  })

  it('writes and reads back a repo snapshot', async () => {
    await writeFeatureSnapshot(repo, {
      name: 'Feature',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(await readFeatureSnapshot(repo)).toEqual({
      name: 'Feature',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    const missing = join(root, 'missing')
    mkdirSync(missing, { recursive: true })
    expect(await readFeatureSnapshot(missing)).toBeNull()
  })

  it('drops the entry when the file list is empty', async () => {
    await writeFeatureSnapshot(repo, {
      name: 'F',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    await writeFeatureSnapshot(repo, { name: 'F', files: [] })
    expect(await readFeatureSnapshot(repo)).toBeNull()
  })

  it('skips an unchanged write (dedup) but persists a real change', async () => {
    const snapshot = {
      name: 'F',
      files: [{ path: 'a.ts' as const, source: 'changed' as const, layer: 'Pages' }],
    }
    await writeFeatureSnapshot(repo, snapshot)
    await writeFeatureSnapshot(repo, snapshot)
    await writeFeatureSnapshot(repo, {
      name: 'F2',
      files: [{ path: 'b.ts', source: 'context', layer: 'Data' }],
    })
    expect(await readFeatureSnapshot(repo)).toEqual({
      name: 'F2',
      files: [{ path: 'b.ts', source: 'context', layer: 'Data' }],
    })
  })
})

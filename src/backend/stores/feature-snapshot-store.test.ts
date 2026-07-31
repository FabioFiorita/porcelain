import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  featureSnapshotPath,
  readFeatureSnapshot,
  writeFeatureSnapshot,
} from './feature-snapshot-store'

const dir = join(tmpdir(), 'porcelain-feature-snapshot-test')
const file = join(dir, 'feature-view.json')

beforeEach(() => {
  process.env.PORCELAIN_FEATURE_VIEW = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_FEATURE_VIEW
  rmSync(dir, { recursive: true, force: true })
})

describe('feature snapshot store', () => {
  it('honours the env override for its path', () => {
    expect(featureSnapshotPath()).toBe(file)
  })

  it('writes and reads back a repo snapshot', async () => {
    await writeFeatureSnapshot('/snap-write', {
      name: 'Feature',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(await readFeatureSnapshot('/snap-write')).toEqual({
      name: 'Feature',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(await readFeatureSnapshot('/missing')).toBeNull()
  })

  it('drops the entry when the file list is empty', async () => {
    await writeFeatureSnapshot('/snap-empty', {
      name: 'F',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    await writeFeatureSnapshot('/snap-empty', { name: 'F', files: [] })
    expect(await readFeatureSnapshot('/snap-empty')).toBeNull()
  })

  it('skips an unchanged write (dedup) but persists a real change', async () => {
    const snapshot = {
      name: 'F',
      files: [{ path: 'a.ts', source: 'changed' as const, layer: 'Pages' }],
    }
    await writeFeatureSnapshot('/snap-dedup', snapshot)
    // Delete the file behind the cache's back: an unchanged re-write must NOT recreate it.
    rmSync(file, { force: true })
    await writeFeatureSnapshot('/snap-dedup', snapshot)
    expect(existsSync(file)).toBe(false)
    // A different snapshot DOES write.
    await writeFeatureSnapshot('/snap-dedup', {
      name: 'F',
      files: [{ path: 'b.ts', source: 'context', layer: 'Hooks' }],
    })
    expect(await readFeatureSnapshot('/snap-dedup')).toMatchObject({
      files: [{ path: 'b.ts', source: 'context', layer: 'Hooks' }],
    })
  })
})

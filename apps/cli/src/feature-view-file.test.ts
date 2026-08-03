import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeFeatureView, readFeatureView, sourceByPath } from './feature-view-file'

const root = join(tmpdir(), 'porcelain-feature-view-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function seed(snap: unknown): void {
  mkdirSync(join(repo, '.porcelain'), { recursive: true })
  writeFileSync(projectPorcelainPath(repo, PROJECT_FILES.featureView), JSON.stringify(snap))
}

describe('readFeatureView', () => {
  it('reads the snapshot, or null when none', () => {
    expect(readFeatureView(repo)).toBeNull()
    seed({
      name: 'X',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
    expect(readFeatureView(repo)).toEqual({
      name: 'X',
      files: [{ path: 'a.ts', source: 'changed', layer: 'Pages' }],
    })
  })

  it('drops malformed rows but keeps valid ones', () => {
    seed({
      name: 'X',
      files: [
        { path: 'ok.ts', source: 'changed', layer: 'Pages' },
        { path: 'bad.ts', source: 'nope', layer: 'Pages' },
        { path: 'nosource.ts', layer: 'Pages' },
      ],
    })
    expect(readFeatureView(repo)?.files).toEqual([
      { path: 'ok.ts', source: 'changed', layer: 'Pages' },
    ])
  })
})

describe('sourceByPath', () => {
  it('maps each file to its source for comment tagging', () => {
    const map = sourceByPath({
      name: 'X',
      files: [
        { path: 'a.ts', source: 'changed', layer: 'P' },
        { path: 'b.ts', source: 'shipped', layer: 'S' },
      ],
    })
    expect(map.get('a.ts')).toBe('changed')
    expect(map.get('b.ts')).toBe('shipped')
  })
})

describe('describeFeatureView', () => {
  it('summarizes the source breakdown and lists files grouped by layer', () => {
    const text = describeFeatureView(repo, {
      name: 'X',
      files: [
        { path: 'a.ts', source: 'changed', layer: 'Pages' },
        { path: 'b.ts', source: 'context', layer: 'Pages' },
        { path: 'c.ts', source: 'shipped', layer: 'Data' },
      ],
    })
    expect(text).toContain('Feature view "X"')
    expect(text).toContain('Pages')
    expect(text).toContain('[changed] a.ts')
    expect(text).toContain('Data')
  })
})

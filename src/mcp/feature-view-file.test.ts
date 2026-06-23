import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeFeatureView, readFeatureView, sourceByPath } from './feature-view-file'

const dir = join(tmpdir(), 'porcelain-feature-view-file-test')
const file = join(dir, 'feature-view.json')

beforeEach(() => {
  process.env.PORCELAIN_FEATURE_VIEW = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_FEATURE_VIEW
  rmSync(dir, { recursive: true, force: true })
})

const seed = (): void => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    file,
    JSON.stringify({
      '/repo': {
        name: 'Crew call-outs',
        files: [
          { path: 'app/page.tsx', source: 'changed', layer: 'Pages' },
          { path: 'server/svc.ts', source: 'shipped', layer: 'Services' },
        ],
      },
    }),
  )
}

describe('readFeatureView', () => {
  it('reads the snapshot, or null when none / the repo is absent', () => {
    expect(readFeatureView('/repo')).toBeNull()
    seed()
    expect(readFeatureView('/repo')?.files).toHaveLength(2)
    expect(readFeatureView('/other')).toBeNull()
  })

  it('drops malformed rows (bad/absent source) but keeps valid ones', () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': {
          name: 'X',
          files: [
            { path: 'ok.ts', source: 'changed', layer: 'Pages' },
            { path: 'bad.ts', source: 'whoops' },
            { path: 'no-layer.ts', source: 'context' },
          ],
        },
      }),
    )
    expect(readFeatureView('/repo')?.files).toEqual([
      { path: 'ok.ts', source: 'changed', layer: 'Pages' },
      { path: 'no-layer.ts', source: 'context', layer: 'Other' },
    ])
  })
})

describe('sourceByPath', () => {
  it('maps each file to its source for comment tagging', () => {
    seed()
    const map = sourceByPath(readFeatureView('/repo'))
    expect(map.get('app/page.tsx')).toBe('changed')
    expect(map.get('server/svc.ts')).toBe('shipped')
    expect(sourceByPath(null).size).toBe(0)
  })
})

describe('describeFeatureView', () => {
  it('hints at no snapshot when none is stored', () => {
    expect(describeFeatureView('/repo', null)).toContain('No feature view computed')
  })

  it('summarizes the source breakdown and lists files grouped by layer', () => {
    seed()
    const text = describeFeatureView('/repo', readFeatureView('/repo'))
    expect(text).toContain('Feature view "Crew call-outs" for /repo: 2 file(s)')
    expect(text).toContain('1 changed')
    expect(text).toContain('1 shipped')
    expect(text).toContain('Pages')
    expect(text).toContain('[changed] app/page.tsx')
    expect(text).toContain('[shipped] server/svc.ts')
  })
})

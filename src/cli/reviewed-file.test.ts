import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { describeReviewed, readReviewed } from './reviewed-file'

const dir = join(tmpdir(), 'porcelain-reviewed-file-test')
const file = join(dir, 'reviewed.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEWED = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEWED
  rmSync(dir, { recursive: true, force: true })
})

function seed(reviewed: Record<string, unknown>): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(reviewed))
}

describe('reviewed-file', () => {
  it('reads a repo-keyed list of paths', () => {
    seed({ '/repo': ['src/a.ts', 'src/b.ts'] })
    expect(readReviewed('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('reads the fingerprinted object shape, exposing only the path', () => {
    seed({
      '/repo': [
        { path: 'src/a.ts', fingerprint: 'abc' },
        { path: 'src/b.ts', fingerprint: '' },
      ],
    })
    expect(readReviewed('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('reads a mix of legacy string and object marks', () => {
    seed({ '/repo': ['legacy.ts', { path: 'src/a.ts', fingerprint: 'abc' }] })
    expect(readReviewed('/repo')).toEqual(['legacy.ts', 'src/a.ts'])
  })

  it('returns an empty list when the file or repo entry is absent', () => {
    expect(readReviewed('/repo')).toEqual([])
    seed({ '/other': ['x.ts'] })
    expect(readReviewed('/repo')).toEqual([])
  })

  it('skips malformed entries and non-array values rather than throwing', () => {
    seed({ '/repo': ['ok.ts', 42, null, {}, { fingerprint: 'x' }], '/bad': 'nope' })
    expect(readReviewed('/repo')).toEqual(['ok.ts'])
    expect(readReviewed('/bad')).toEqual([])
  })

  it('describes the reviewed files with a header listing each', () => {
    const text = describeReviewed('/repo', ['src/a.ts', 'src/b.ts'])
    expect(text).toContain('2 file(s) marked reviewed')
    expect(text).toContain('src/a.ts')
    expect(text).toContain('src/b.ts')
    expect(text).toContain('/repo')
  })

  it('describes an empty review with a hint, not a list', () => {
    const text = describeReviewed('/repo', [])
    expect(text).toContain('No files marked reviewed for /repo')
  })
})

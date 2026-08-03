import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearScope,
  describeScope,
  hidePath,
  pinPath,
  readScope,
  resolveScopePath,
  unhidePath,
  unpinPath,
} from './scope-file'

const dir = join(tmpdir(), 'porcelain-scope-file-test')
const file = join(dir, 'scope.json')

beforeEach(() => {
  process.env.PORCELAIN_SCOPE = file
  rmSync(dir, { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_SCOPE
  rmSync(dir, { recursive: true, force: true })
})

describe('resolveScopePath', () => {
  it('joins relative paths', () => {
    expect(resolveScopePath('/repo', 'apps/a')).toBe('/repo/apps/a')
  })
})

describe('scope-file', () => {
  it('round-trips hide/pin and describe', () => {
    hidePath('/repo', 'apps/legacy')
    pinPath('/repo', 'apps/web')
    const scope = readScope('/repo')
    expect(scope.hiddenPaths).toEqual(['/repo/apps/legacy'])
    expect(scope.pinnedPaths).toEqual(['/repo/apps/web'])
    const text = describeScope('/repo', scope)
    expect(text).toContain('apps/legacy')
    expect(text).toContain('apps/web')
    unhidePath('/repo', 'apps/legacy')
    unpinPath('/repo', 'apps/web')
    expect(readScope('/repo').hiddenPaths).toEqual([])
    expect(readScope('/repo').pinnedPaths).toEqual([])
  })

  it('clear drops the repo entry', () => {
    hidePath('/repo', 'x')
    clearScope('/repo')
    expect(readScope('/repo')).toEqual({ hiddenPaths: [], pinnedPaths: [] })
  })
})

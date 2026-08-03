import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// Typecheck uses the desktop vitest aliases: this test reaches into apps/daemon via
// @backend; the runtime layers-file.ts never does.
import { DEFAULT_LAYERS as MAIN_DEFAULT_LAYERS } from '@backend/review/flow'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearLayers,
  DEFAULT_LAYERS,
  describeLayers,
  readLayers,
  setLayers,
  toLayers,
} from './layers-file'

describe('DEFAULT_LAYERS', () => {
  it('stays identical to the app source of truth (apps/daemon/src/review/flow.ts)', () => {
    // The CLI island duplicates the defaults rather than import from apps/daemon; this
    // guard makes the copy impossible to let drift.
    expect(DEFAULT_LAYERS).toEqual(MAIN_DEFAULT_LAYERS)
  })

  it('is starter Docs + Agents only', () => {
    expect(DEFAULT_LAYERS.map((l) => l.label)).toEqual(['Docs', 'Agents'])
  })
})

describe('toLayers', () => {
  it('validates and returns the ordered set', () => {
    const layers = [{ label: 'Pages', pattern: '(^|/)pages/' }]
    expect(toLayers(layers)).toEqual(layers)
  })

  it('rejects a non-array', () => {
    expect(() => toLayers('nope')).toThrow('must be an array')
  })

  it('rejects an empty set (that is reset, not set)', () => {
    expect(() => toLayers([])).toThrow('at least one entry')
  })

  it('rejects a blank label', () => {
    expect(() => toLayers([{ label: '  ', pattern: '(^|/)a/' }])).toThrow('label')
  })

  it('rejects an invalid regex pattern', () => {
    expect(() => toLayers([{ label: 'Bad', pattern: '(' }])).toThrow('valid regular expression')
  })
})

describe('describeLayers', () => {
  it('shows the starters (with JSON) when no custom set exists', () => {
    const text = describeLayers('/repo', null)
    expect(text).toContain('starter groups')
    expect(text).toContain('Docs')
    expect(text).toContain('Agents')
    expect(text).not.toContain('Pages')
    expect(text).toContain('porcelain layers set')
  })

  it('lists a custom set with its JSON for round-tripping', () => {
    const text = describeLayers('/repo', [{ label: 'Routes', pattern: '(^|/)routes/' }])
    expect(text).toContain('Custom flow layers')
    expect(text).toContain('Routes')
    expect(text).toContain('(^|/)routes/')
    expect(text).toContain('Docs + Agents starters')
  })
})

describe('layers-file round-trip', () => {
  const dir = join(tmpdir(), 'porcelain-layers-file-test')
  const file = join(dir, 'layers.json')
  beforeEach(() => {
    process.env.PORCELAIN_LAYERS = file
    rmSync(dir, { recursive: true, force: true })
  })
  afterEach(() => {
    delete process.env.PORCELAIN_LAYERS
    rmSync(dir, { recursive: true, force: true })
  })

  it('sets, reads, and resets a repo (custom → starters)', () => {
    const layers = [{ label: 'Hooks', pattern: '(^|/)hooks?/' }]
    expect(readLayers('/repo')).toBeNull()
    setLayers('/repo', layers)
    expect(readLayers('/repo')).toEqual(layers)
    clearLayers('/repo')
    expect(readLayers('/repo')).toBeNull()
  })

  it('keeps repos isolated', () => {
    setLayers('/r1', [{ label: 'A', pattern: '(^|/)a/' }])
    setLayers('/r2', [{ label: 'B', pattern: '(^|/)b/' }])
    expect(readLayers('/r1')).toEqual([{ label: 'A', pattern: '(^|/)a/' }])
    expect(readLayers('/r2')).toEqual([{ label: 'B', pattern: '(^|/)b/' }])
  })
})

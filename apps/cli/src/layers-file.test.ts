import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_LAYERS as MAIN_DEFAULT_LAYERS } from '@backend/features/project-data'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearLayers,
  DEFAULT_LAYERS,
  describeLayers,
  readLayers,
  setLayers,
  toLayers,
} from './layers-file'

const root = join(tmpdir(), 'porcelain-layers-file-test')
const repo = join(root, 'repo')

describe('DEFAULT_LAYERS', () => {
  it('stays identical to the app source of truth', () => {
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

  it('rejects an empty set', () => {
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
  it('shows the starters when no custom set exists', () => {
    const text = describeLayers(repo, null)
    expect(text).toContain('Docs')
    expect(text).toContain('Agents')
  })

  it('lists a custom set with its JSON', () => {
    const text = describeLayers(repo, [{ label: 'Routes', pattern: '(^|/)routes/' }])
    expect(text).toContain('Custom flow layers')
    expect(text).toContain('Routes')
  })
})

describe('layers-file round-trip', () => {
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true })
    mkdirSync(repo, { recursive: true })
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('writes and reads a custom set, reset clears', () => {
    const layers = [{ label: 'Pages', pattern: '(^|/)pages/' }]
    setLayers(repo, layers)
    expect(readLayers(repo)).toEqual(layers)
    clearLayers(repo)
    expect(readLayers(repo)).toBeNull()
  })

  it('keeps repos isolated', () => {
    const r1 = join(root, 'r1')
    const r2 = join(root, 'r2')
    mkdirSync(r1, { recursive: true })
    mkdirSync(r2, { recursive: true })
    setLayers(r1, [{ label: 'A', pattern: '(^|/)a/' }])
    setLayers(r2, [{ label: 'B', pattern: '(^|/)b/' }])
    expect(readLayers(r1)?.[0]?.label).toBe('A')
    expect(readLayers(r2)?.[0]?.label).toBe('B')
  })
})

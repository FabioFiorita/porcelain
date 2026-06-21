import { rmSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateLayersFromConfig, readLayers, writeLayers } from './layers-store'

// config-store imports electron (no real module under vitest), and the migration
// reads it — mock it so we control the legacy config without booting electron.
const { loadConfig } = vi.hoisted(() => ({ loadConfig: vi.fn() }))
vi.mock('./config-store', () => ({ loadConfig }))

const dir = join(tmpdir(), 'porcelain-layers-store-test')
const file = join(dir, 'layers.json')
const layers = [
  { label: 'Pages', pattern: '(^|/)pages/' },
  { label: 'Data', pattern: '(^|/)models?/' },
]

beforeEach(() => {
  process.env.PORCELAIN_LAYERS = file
  rmSync(dir, { recursive: true, force: true })
  loadConfig.mockReset()
})
afterEach(() => {
  delete process.env.PORCELAIN_LAYERS
  rmSync(dir, { recursive: true, force: true })
})

describe('layers-store', () => {
  it('writes layers and reads them back in order', async () => {
    await writeLayers('/repo', layers)
    expect(await readLayers('/repo')).toEqual(layers)
  })

  it('returns null for a repo with no custom layers', async () => {
    expect(await readLayers('/repo')).toBeNull()
  })

  it('keeps repos isolated', async () => {
    await writeLayers('/r1', [{ label: 'A', pattern: '(^|/)a/' }])
    await writeLayers('/r2', [{ label: 'B', pattern: '(^|/)b/' }])
    expect(await readLayers('/r1')).toEqual([{ label: 'A', pattern: '(^|/)a/' }])
    expect(await readLayers('/r2')).toEqual([{ label: 'B', pattern: '(^|/)b/' }])
  })

  it('clears the override back to defaults (null drops the entry)', async () => {
    await writeLayers('/repo', layers)
    await writeLayers('/repo', null)
    expect(await readLayers('/repo')).toBeNull()
  })

  it('drops uncompilable patterns on read so flow grouping never throws', async () => {
    await mkdir(dirname(file), { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        '/repo': [
          { label: 'Good', pattern: '(^|/)ok/' },
          { label: 'Bad', pattern: '(' }, // invalid regex
          { label: 'Empty', pattern: '' },
        ],
      }),
    )
    expect(await readLayers('/repo')).toEqual([{ label: 'Good', pattern: '(^|/)ok/' }])
  })

  it('treats a repo whose layers all drop as having none', async () => {
    await mkdir(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({ '/repo': [{ label: 'Bad', pattern: '(' }] }))
    expect(await readLayers('/repo')).toBeNull()
  })
})

describe('migrateLayersFromConfig', () => {
  const repo = (extra: object) => ({
    hiddenPaths: [],
    pinnedPaths: [],
    reviewedPaths: [],
    ...extra,
  })

  it('copies legacy config layers into the layers channel', async () => {
    loadConfig.mockResolvedValue({ recentRepos: [], repos: { '/repo': repo({ layers }) } })
    await migrateLayersFromConfig()
    expect(await readLayers('/repo')).toEqual(layers)
  })

  it('never clobbers a newer in-app edit already in the channel', async () => {
    const current = [{ label: 'New', pattern: '(^|/)new/' }]
    await writeLayers('/repo', current)
    loadConfig.mockResolvedValue({ recentRepos: [], repos: { '/repo': repo({ layers }) } })
    await migrateLayersFromConfig()
    expect(await readLayers('/repo')).toEqual(current)
  })

  it('no-ops when no repo has legacy layers', async () => {
    loadConfig.mockResolvedValue({ recentRepos: [], repos: { '/repo': repo({}) } })
    await migrateLayersFromConfig()
    expect(await readLayers('/repo')).toBeNull()
  })
})

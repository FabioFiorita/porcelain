import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearReviewedPaths,
  markReviewed,
  migrateReviewedFromConfig,
  readReviewedPaths,
  unmarkReviewed,
} from './reviewed-store'

// config-store imports electron (no real module under vitest), and the migration
// reads it — mock it so we control the legacy config without booting electron.
const { loadConfig } = vi.hoisted(() => ({ loadConfig: vi.fn() }))
vi.mock('./config-store', () => ({ loadConfig }))

const dir = join(tmpdir(), 'porcelain-reviewed-store-test')
const file = join(dir, 'reviewed.json')

beforeEach(() => {
  process.env.PORCELAIN_REVIEWED = file
  rmSync(dir, { recursive: true, force: true })
  loadConfig.mockReset()
})
afterEach(() => {
  delete process.env.PORCELAIN_REVIEWED
  rmSync(dir, { recursive: true, force: true })
})

describe('reviewed-store', () => {
  it('marks paths reviewed and reads them back', async () => {
    await markReviewed('/repo', 'src/a.ts')
    await markReviewed('/repo', 'src/b.ts')
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('returns an empty list for a repo with no marks', async () => {
    expect(await readReviewedPaths('/repo')).toEqual([])
  })

  it('marking is idempotent', async () => {
    await markReviewed('/repo', 'src/a.ts')
    await markReviewed('/repo', 'src/a.ts')
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts'])
  })

  it('unmarks a path and drops the entry when the last mark is removed', async () => {
    await markReviewed('/repo', 'src/a.ts')
    await unmarkReviewed('/repo', 'src/a.ts')
    expect(await readReviewedPaths('/repo')).toEqual([])
  })

  it('unmarking a path that was never marked is a no-op', async () => {
    await markReviewed('/repo', 'src/a.ts')
    await unmarkReviewed('/repo', 'src/b.ts')
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts'])
  })

  it('clears many marks at once (committed files) and keeps the rest', async () => {
    await markReviewed('/repo', 'src/a.ts')
    await markReviewed('/repo', 'src/b.ts')
    await markReviewed('/repo', 'src/c.ts')
    await clearReviewedPaths('/repo', ['src/a.ts', 'src/c.ts', 'src/never.ts'])
    expect(await readReviewedPaths('/repo')).toEqual(['src/b.ts'])
  })

  it('keeps repos isolated', async () => {
    await markReviewed('/r1', 'a.ts')
    await markReviewed('/r2', 'b.ts')
    expect(await readReviewedPaths('/r1')).toEqual(['a.ts'])
    expect(await readReviewedPaths('/r2')).toEqual(['b.ts'])
  })
})

describe('migrateReviewedFromConfig', () => {
  it('copies legacy config reviewed marks into the channel', async () => {
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: ['src/a.ts'] } },
    })
    await migrateReviewedFromConfig()
    expect(await readReviewedPaths('/repo')).toEqual(['src/a.ts'])
  })

  it('never clobbers newer in-app marks already in the channel', async () => {
    await markReviewed('/repo', 'src/new.ts')
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: ['src/old.ts'] } },
    })
    await migrateReviewedFromConfig()
    expect(await readReviewedPaths('/repo')).toEqual(['src/new.ts'])
  })

  it('no-ops when no repo has legacy marks', async () => {
    loadConfig.mockResolvedValue({
      recentRepos: [],
      repos: { '/repo': { hiddenPaths: [], pinnedPaths: [], reviewedPaths: [] } },
    })
    await migrateReviewedFromConfig()
    expect(await readReviewedPaths('/repo')).toEqual([])
  })
})

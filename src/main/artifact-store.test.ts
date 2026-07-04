import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearArtifact, MAX_HTML_BYTES, readArtifact, readArtifactMeta } from './artifact-store'

const file = join(tmpdir(), 'porcelain-artifact-store-test', 'artifacts.json')
const write = (data: unknown): void => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data))
}
const read = (): Record<string, unknown> => JSON.parse(readFileSync(file, 'utf8'))

beforeEach(() => {
  process.env.PORCELAIN_ARTIFACTS = file
  rmSync(dirname(file), { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_ARTIFACTS
  rmSync(dirname(file), { recursive: true, force: true })
})

describe('readArtifact', () => {
  it('returns the stored artifact for a repo', async () => {
    write({
      '/repo': { title: 'Overview', html: '<h1>hi</h1>', updatedAt: '2026-07-04T00:00:00Z' },
    })
    expect(await readArtifact('/repo')).toEqual({
      title: 'Overview',
      html: '<h1>hi</h1>',
      updatedAt: '2026-07-04T00:00:00Z',
    })
  })

  it('returns null when the repo has no artifact', async () => {
    write({ '/other': { title: 'x', html: '<p>x</p>', updatedAt: '' } })
    expect(await readArtifact('/repo')).toBeNull()
  })

  it('returns null (never throws) when the file is absent or corrupt', async () => {
    expect(await readArtifact('/repo')).toBeNull()
    write('not an object')
    expect(await readArtifact('/repo')).toBeNull()
  })

  it('drops a malformed entry (missing fields) as absent', async () => {
    write({ '/repo': { title: 'Overview' } })
    expect(await readArtifact('/repo')).toBeNull()
  })

  it('drops an entry whose html exceeds the size cap', async () => {
    write({
      '/repo': { title: 'Big', html: 'x'.repeat(MAX_HTML_BYTES + 1), updatedAt: '' },
    })
    expect(await readArtifact('/repo')).toBeNull()
  })
})

describe('readArtifactMeta', () => {
  it('returns title + updatedAt without the html', async () => {
    write({
      '/repo': { title: 'Overview', html: '<h1>hi</h1>', updatedAt: '2026-07-04T00:00:00Z' },
    })
    expect(await readArtifactMeta('/repo')).toEqual({
      title: 'Overview',
      updatedAt: '2026-07-04T00:00:00Z',
    })
  })

  it('returns null when there is no artifact', async () => {
    expect(await readArtifactMeta('/repo')).toBeNull()
  })
})

describe('clearArtifact', () => {
  it('removes only the target repo, leaving the others', async () => {
    write({
      '/repo': { title: 'A', html: '<p>a</p>', updatedAt: '' },
      '/other': { title: 'B', html: '<p>b</p>', updatedAt: '' },
    })
    await clearArtifact('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
  })

  it('is a no-op when the repo has no artifact', async () => {
    write({ '/other': { title: 'B', html: '<p>b</p>', updatedAt: '' } })
    await clearArtifact('/repo')
    expect(read()['/other']).toBeDefined()
  })

  it('is a no-op (no throw) when the file is absent', async () => {
    await expect(clearArtifact('/repo')).resolves.toBeUndefined()
  })
})

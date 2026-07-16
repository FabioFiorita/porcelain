import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearEvidence, MAX_HTML_BYTES, readEvidence, readEvidenceMeta } from './evidence-store'

const file = join(tmpdir(), 'porcelain-evidence-store-test', 'evidence.json')
const write = (data: unknown): void => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data))
}
const read = (): Record<string, unknown> => JSON.parse(readFileSync(file, 'utf8'))

beforeEach(() => {
  process.env.PORCELAIN_EVIDENCE = file
  rmSync(dirname(file), { recursive: true, force: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_EVIDENCE
  rmSync(dirname(file), { recursive: true, force: true })
})

describe('readEvidence', () => {
  it('returns the stored evidence for a repo', async () => {
    write({
      '/repo': { title: 'Vite loop', html: '<h1>hi</h1>', updatedAt: '2026-07-04T00:00:00Z' },
    })
    expect(await readEvidence('/repo')).toEqual({
      title: 'Vite loop',
      html: '<h1>hi</h1>',
      updatedAt: '2026-07-04T00:00:00Z',
    })
  })

  it('returns null when the repo has no evidence', async () => {
    write({ '/other': { title: 'x', html: '<p>x</p>', updatedAt: '' } })
    expect(await readEvidence('/repo')).toBeNull()
  })

  it('returns null (never throws) when the file is absent or corrupt', async () => {
    expect(await readEvidence('/repo')).toBeNull()
    write('not an object')
    expect(await readEvidence('/repo')).toBeNull()
  })

  it('drops a malformed entry (missing fields) as absent', async () => {
    write({ '/repo': { title: 'Vite loop' } })
    expect(await readEvidence('/repo')).toBeNull()
  })

  it('drops an entry whose html exceeds the size cap', async () => {
    write({
      '/repo': { title: 'Big', html: 'x'.repeat(MAX_HTML_BYTES + 1), updatedAt: '' },
    })
    expect(await readEvidence('/repo')).toBeNull()
  })
})

describe('readEvidenceMeta', () => {
  it('returns title + updatedAt without the html', async () => {
    write({
      '/repo': { title: 'Vite loop', html: '<h1>hi</h1>', updatedAt: '2026-07-04T00:00:00Z' },
    })
    expect(await readEvidenceMeta('/repo')).toEqual({
      title: 'Vite loop',
      updatedAt: '2026-07-04T00:00:00Z',
    })
  })

  it('returns null when there is no evidence', async () => {
    expect(await readEvidenceMeta('/repo')).toBeNull()
  })
})

describe('clearEvidence', () => {
  it('removes only the target repo, leaving the others', async () => {
    write({
      '/repo': { title: 'A', html: '<p>a</p>', updatedAt: '' },
      '/other': { title: 'B', html: '<p>b</p>', updatedAt: '' },
    })
    await clearEvidence('/repo')
    const all = read()
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
  })

  it('is a no-op when the repo has no evidence', async () => {
    write({ '/other': { title: 'B', html: '<p>b</p>', updatedAt: '' } })
    await clearEvidence('/repo')
    expect(read()['/other']).toBeDefined()
  })

  it('is a no-op (no throw) when the file is absent', async () => {
    await expect(clearEvidence('/repo')).resolves.toBeUndefined()
  })
})

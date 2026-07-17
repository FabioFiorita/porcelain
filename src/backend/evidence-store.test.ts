import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearEvidence,
  evidenceDirForRepo,
  MAX_HTML_BYTES,
  readEvidence,
  readEvidenceMeta,
} from './evidence-store'

const root = join(tmpdir(), 'porcelain-evidence-store-test')
const legacyFile = join(root, 'evidence.json')
const diskRoot = join(root, 'loop-evidence')

const keyFor = (repo: string): string =>
  createHash('sha256').update(repo).digest('hex').slice(0, 16)

const writeDisk = (repo: string, title: string, html: string): string => {
  const dir = join(diskRoot, keyFor(repo))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ title, repoPath: repo, updatedAt: '2026-07-17T00:00:00.000Z' }),
  )
  return dir
}

beforeEach(() => {
  process.env.PORCELAIN_EVIDENCE = legacyFile
  process.env.PORCELAIN_LOOP_EVIDENCE_DIR = diskRoot
  rmSync(root, { recursive: true, force: true })
  mkdirSync(root, { recursive: true })
})
afterEach(() => {
  delete process.env.PORCELAIN_EVIDENCE
  delete process.env.PORCELAIN_LOOP_EVIDENCE_DIR
  rmSync(root, { recursive: true, force: true })
})

describe('readEvidence (disk-first)', () => {
  it('returns evidence from the on-disk directory', async () => {
    const dir = writeDisk('/repo', 'Vite loop', '<h1>hi</h1>')
    expect(await readEvidence('/repo')).toEqual({
      title: 'Vite loop',
      html: '<h1>hi</h1>',
      updatedAt: '2026-07-17T00:00:00.000Z',
      dir,
    })
    expect(evidenceDirForRepo('/repo')).toBe(dir)
  })

  it('inlines sibling screenshots into the html for the viewer', async () => {
    const dir = writeDisk('/repo', 'With shot', '<img src="shot.png">')
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const evidence = await readEvidence('/repo')
    expect(evidence?.html).toMatch(/data:image\/png;base64,/)
  })

  it('returns null when there is no index.html', async () => {
    expect(await readEvidence('/repo')).toBeNull()
  })

  it('falls back to legacy evidence.json', async () => {
    mkdirSync(dirname(legacyFile), { recursive: true })
    writeFileSync(
      legacyFile,
      JSON.stringify({
        '/repo': { title: 'Legacy', html: '<p>old</p>', updatedAt: '2026-01-01T00:00:00Z' },
      }),
    )
    expect(await readEvidence('/repo')).toMatchObject({
      title: 'Legacy',
      html: '<p>old</p>',
    })
  })

  it('drops oversized index.html as absent', async () => {
    writeDisk('/repo', 'Big', 'x'.repeat(MAX_HTML_BYTES + 1))
    expect(await readEvidence('/repo')).toBeNull()
  })
})

describe('readEvidenceMeta', () => {
  it('returns title without loading html when index exists', async () => {
    writeDisk('/repo', 'Vite loop', '<h1>hi</h1>')
    expect(await readEvidenceMeta('/repo')).toMatchObject({
      title: 'Vite loop',
      updatedAt: '2026-07-17T00:00:00.000Z',
    })
  })

  it('returns null when there is no evidence', async () => {
    expect(await readEvidenceMeta('/repo')).toBeNull()
  })
})

describe('clearEvidence', () => {
  it('removes the on-disk directory', async () => {
    const dir = writeDisk('/repo', 'A', '<p>a</p>')
    await clearEvidence('/repo')
    expect(await readEvidence('/repo')).toBeNull()
    expect(() => readFileSync(join(dir, 'index.html'))).toThrow()
  })

  it('also clears a legacy json entry', async () => {
    writeFileSync(
      legacyFile,
      JSON.stringify({
        '/repo': { title: 'A', html: '<p>a</p>', updatedAt: '' },
        '/other': { title: 'B', html: '<p>b</p>', updatedAt: '' },
      }),
    )
    await clearEvidence('/repo')
    const all = JSON.parse(readFileSync(legacyFile, 'utf8')) as Record<string, unknown>
    expect(all['/repo']).toBeUndefined()
    expect(all['/other']).toBeDefined()
  })

  it('is a no-op when nothing exists', async () => {
    await expect(clearEvidence('/repo')).resolves.toBeUndefined()
  })
})

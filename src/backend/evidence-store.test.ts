import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearEvidence,
  type EvidenceCheck,
  evidenceDirForRepo,
  evidenceOverallStatus,
  MAX_HTML_BYTES,
  readEvidence,
  readEvidenceMeta,
} from './evidence-store'

const root = join(tmpdir(), 'porcelain-evidence-store-test')
const legacyFile = join(root, 'evidence.json')
const diskRoot = join(root, 'loop-evidence')

const keyFor = (repo: string): string =>
  createHash('sha256').update(repo).digest('hex').slice(0, 16)

const writeDisk = (repo: string, title: string, html: string, checks?: unknown): string => {
  const dir = join(diskRoot, keyFor(repo))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html)
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ title, repoPath: repo, updatedAt: '2026-07-17T00:00:00.000Z', checks }),
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
      checks: [],
      medium: 'html',
    })
    expect(evidenceDirForRepo('/repo')).toBe(dir)
  })

  it('reads an Excalidraw scene body when index.html is absent', async () => {
    const dir = join(diskRoot, keyFor('/repo'))
    mkdirSync(dir, { recursive: true })
    const scene = {
      type: 'excalidraw',
      version: 2,
      elements: [{ id: '1', type: 'rectangle', x: 0, y: 0, width: 40, height: 20 }],
      appState: {},
      files: {},
    }
    writeFileSync(join(dir, 'canvas.excalidraw'), JSON.stringify(scene))
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({
        title: 'Arch board',
        repoPath: '/repo',
        updatedAt: '2026-07-20T00:00:00.000Z',
      }),
    )
    const evidence = await readEvidence('/repo')
    expect(evidence).toMatchObject({
      title: 'Arch board',
      medium: 'excalidraw',
      dir,
    })
    expect(evidence?.scene?.elements).toHaveLength(1)
    expect(evidence?.html).toBeUndefined()
  })

  it('prefers HTML over Excalidraw when both bodies exist', async () => {
    const dir = writeDisk('/repo', 'Both', '<p>html wins</p>')
    writeFileSync(
      join(dir, 'canvas.excalidraw'),
      JSON.stringify({ elements: [{ id: '1', type: 'rectangle' }] }),
    )
    const evidence = await readEvidence('/repo')
    expect(evidence?.medium).toBe('html')
    expect(evidence?.html).toContain('html wins')
  })

  it('reads back valid structured checks', async () => {
    const checks: EvidenceCheck[] = [
      { label: 'pnpm test', status: 'pass', detail: '1348 passed' },
      { label: 'pnpm build', status: 'skip' },
    ]
    writeDisk('/repo', 'Loop', '<h1>hi</h1>', checks)
    expect((await readEvidence('/repo'))?.checks).toEqual(checks)
    expect((await readEvidenceMeta('/repo'))?.checks).toEqual(checks)
  })

  it('drops a malformed checks field leniently (meta still read)', async () => {
    writeDisk('/repo', 'Loop', '<h1>hi</h1>', [{ label: 'x', status: 'bogus' }])
    const evidence = await readEvidence('/repo')
    expect(evidence?.title).toBe('Loop')
    expect(evidence?.checks).toEqual([])
  })

  it('drops an over-cap checks list leniently', async () => {
    const tooMany = Array.from({ length: 33 }, (_, i) => ({ label: `c${i}`, status: 'pass' }))
    writeDisk('/repo', 'Loop', '<h1>hi</h1>', tooMany)
    expect((await readEvidenceMeta('/repo'))?.checks).toEqual([])
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
      medium: 'html',
    })
  })

  it('returns meta for a scene-only evidence dir', async () => {
    const dir = join(diskRoot, keyFor('/repo'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'canvas.excalidraw'), JSON.stringify({ elements: [] }))
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({ title: 'Scene only', updatedAt: '2026-07-20T00:00:00.000Z' }),
    )
    expect(await readEvidenceMeta('/repo')).toMatchObject({
      title: 'Scene only',
      medium: 'excalidraw',
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

describe('evidenceOverallStatus', () => {
  const check = (status: EvidenceCheck['status']): EvidenceCheck => ({ label: status, status })

  it('is null for an empty list (no signal)', () => {
    expect(evidenceOverallStatus([])).toBeNull()
  })

  it("is 'pass' when every check passes", () => {
    expect(evidenceOverallStatus([check('pass'), check('pass')])).toBe('pass')
  })

  it('lets a single fail win', () => {
    expect(evidenceOverallStatus([check('pass'), check('fail'), check('skip')])).toBe('fail')
  })

  it('is null for skip-only', () => {
    expect(evidenceOverallStatus([check('skip'), check('skip')])).toBeNull()
  })

  it("is 'pass' for pass + skip with no fail", () => {
    expect(evidenceOverallStatus([check('pass'), check('skip')])).toBe('pass')
  })
})

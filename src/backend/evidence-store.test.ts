import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
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

const META_AT = '2026-07-17T00:00:00.000Z'

const writeDisk = (repo: string, title: string, html: string, checks?: unknown): string => {
  const dir = join(diskRoot, keyFor(repo))
  mkdirSync(dir, { recursive: true })
  const indexPath = join(dir, 'index.html')
  writeFileSync(indexPath, html)
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ title, repoPath: repo, updatedAt: META_AT, checks }),
  )
  // Pin body mtime to the meta stamp so tests assert the fixed value unless they
  // deliberately bump mtime (resolveUpdatedAt takes the later of the two).
  const pinned = new Date(META_AT)
  utimesSync(indexPath, pinned, pinned)
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
      updatedAt: META_AT,
      dir,
      checks: [],
      medium: 'html',
    })
    expect(evidenceDirForRepo('/repo')).toBe(dir)
  })

  it('ignores a scene-only dir (Excalidraw is Intent-only, not evidence)', async () => {
    const dir = join(diskRoot, keyFor('/repo'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'canvas.excalidraw'),
      JSON.stringify({ type: 'excalidraw', elements: [{ id: '1', type: 'rectangle' }] }),
    )
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({
        title: 'Arch board',
        repoPath: '/repo',
        updatedAt: '2026-07-20T00:00:00.000Z',
      }),
    )
    expect(await readEvidence('/repo')).toBeNull()
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

  it('surfaces htmlUnavailable when index.html alone exceeds the cap (not null)', async () => {
    writeDisk('/repo', 'Big', 'x'.repeat(MAX_HTML_BYTES + 1))
    const evidence = await readEvidence('/repo')
    expect(evidence).toMatchObject({
      title: 'Big',
      medium: 'html',
      htmlUnavailable: {
        reason: 'too-large',
        bytes: MAX_HTML_BYTES + 1,
        maxBytes: MAX_HTML_BYTES,
      },
    })
    expect(evidence?.html).toBeUndefined()
  })

  it('surfaces htmlUnavailable when post-inline size exceeds the cap', async () => {
    const dir = writeDisk('/repo', 'Big shots', '<img src="shot.png">')
    // ~3.2 MB binary → base64 data-URI pushes the inlined document over 4 MB.
    writeFileSync(join(dir, 'shot.png'), Buffer.alloc(3_200_000, 1))
    const evidence = await readEvidence('/repo')
    expect(evidence).toMatchObject({
      title: 'Big shots',
      htmlUnavailable: { reason: 'too-large', maxBytes: MAX_HTML_BYTES },
    })
    expect(evidence?.html).toBeUndefined()
    expect(evidence?.htmlUnavailable?.bytes).toBeGreaterThan(MAX_HTML_BYTES)
  })

  it('uses the later of meta.updatedAt and index.html mtime', async () => {
    const dir = writeDisk('/repo', 'Vite', '<h1>hi</h1>')
    const later = new Date('2026-07-21T12:00:00.000Z')
    utimesSync(join(dir, 'index.html'), later, later)
    const evidence = await readEvidence('/repo')
    expect(evidence?.updatedAt).toBe(later.toISOString())
    // meta still wins when it is newer than the body mtime
    expect((await readEvidenceMeta('/repo'))?.updatedAt).toBe(later.toISOString())
  })

  it('keeps meta.updatedAt when it is newer than the body mtime', async () => {
    const dir = writeDisk('/repo', 'Vite', '<h1>hi</h1>')
    // writeDisk stamps meta at 2026-07-17; push body mtime into the past
    const earlier = new Date('2020-01-01T00:00:00.000Z')
    utimesSync(join(dir, 'index.html'), earlier, earlier)
    expect((await readEvidence('/repo'))?.updatedAt).toBe(META_AT)
  })
})

describe('readEvidenceMeta', () => {
  it('returns title without loading html when index exists', async () => {
    writeDisk('/repo', 'Vite loop', '<h1>hi</h1>')
    expect(await readEvidenceMeta('/repo')).toMatchObject({
      title: 'Vite loop',
      updatedAt: META_AT,
      medium: 'html',
    })
  })

  it('returns null for a scene-only dir (no HTML body)', async () => {
    const dir = join(diskRoot, keyFor('/repo'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'canvas.excalidraw'), JSON.stringify({ elements: [] }))
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({ title: 'Scene only', updatedAt: '2026-07-20T00:00:00.000Z' }),
    )
    expect(await readEvidenceMeta('/repo')).toBeNull()
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

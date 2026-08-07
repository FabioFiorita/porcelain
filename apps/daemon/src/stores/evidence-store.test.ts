import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
} from '@shared/project-porcelain'
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
const repo = join(root, 'repo')

const META_AT = '2026-07-17T00:00:00.000Z'

const writeDisk = (title: string, html: string, checks?: unknown): string => {
  const dir = projectEvidenceDir(repo)
  mkdirSync(dir, { recursive: true })
  const indexPath = join(dir, 'index.html')
  writeFileSync(indexPath, html)
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ title, repoPath: repo, updatedAt: META_AT, checks }),
  )
  const pinned = new Date(META_AT)
  utimesSync(indexPath, pinned, pinned)
  return dir
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('readEvidence (disk-first)', () => {
  it('returns evidence from the on-disk directory', async () => {
    const dir = writeDisk('Vite loop', '<h1>hi</h1>')
    expect(await readEvidence(repo)).toEqual({
      title: 'Vite loop',
      html: '<h1>hi</h1>',
      updatedAt: META_AT,
      dir,
      checks: [],
      medium: 'html',
    })
  })

  it('returns null when index.html is absent', async () => {
    expect(await readEvidence(repo)).toBeNull()
  })

  it('reads meta title and checks', async () => {
    const checks: EvidenceCheck[] = [{ label: 'unit', status: 'pass' }]
    writeDisk('Pack', '<p>x</p>', checks)
    expect(await readEvidenceMeta(repo)).toMatchObject({
      title: 'Pack',
      checks,
      medium: 'html',
    })
  })

  it('surfaces htmlUnavailable when body exceeds the read cap', async () => {
    const huge = 'x'.repeat(MAX_HTML_BYTES + 1)
    writeDisk('Big', huge)
    const evidence = await readEvidence(repo)
    expect(evidence?.html).toBeUndefined()
    expect(evidence?.htmlUnavailable?.reason).toBe('too-large')
    expect(evidence?.title).toBe('Big')
  })
})

describe('clearEvidence', () => {
  it('removes the evidence directory', async () => {
    writeDisk('T', '<p>1</p>')
    expect(await readEvidence(repo)).not.toBeNull()
    await clearEvidence(repo)
    expect(await readEvidence(repo)).toBeNull()
  })
})

describe('evidenceDirForRepo', () => {
  it('points under <repo>/.porcelain/evidence', () => {
    expect(evidenceDirForRepo(repo)).toBe(projectEvidenceDir(repo))
  })
})

describe('evidenceOverallStatus', () => {
  it('derives overall from checks', () => {
    expect(evidenceOverallStatus([])).toBeNull()
    expect(evidenceOverallStatus([{ label: 'a', status: 'pass' }])).toBe('pass')
    expect(
      evidenceOverallStatus([
        { label: 'a', status: 'pass' },
        { label: 'b', status: 'fail' },
      ]),
    ).toBe('fail')
  })
})

describe('mtime resolution', () => {
  it('uses later of meta and body mtime', async () => {
    const dir = writeDisk('T', '<p>1</p>')
    const indexPath = join(dir, 'index.html')
    const later = new Date('2026-07-18T00:00:00.000Z')
    utimesSync(indexPath, later, later)
    const meta = await readEvidenceMeta(repo)
    expect(meta?.updatedAt).toBe(later.toISOString())
  })

  it('picks up a file dropped into results/ or assets/', async () => {
    writeDisk('T', '<p>1</p>')
    const later = new Date('2026-07-19T00:00:00.000Z')
    const shot = join(projectEvidenceAssetsDir(repo), 'shot.png')
    mkdirSync(projectEvidenceAssetsDir(repo), { recursive: true })
    writeFileSync(shot, 'png')
    utimesSync(shot, later, later)
    expect((await readEvidenceMeta(repo))?.updatedAt).toBe(later.toISOString())
  })
})

/**
 * The presence rule is the whole point of the pack redesign: checks alone, a
 * Results document alone, or a gallery alone is evidence. Only an empty (or
 * absent) directory is "no evidence yet".
 */
describe('evidence pack presence', () => {
  const writeInto = (dir: string, name: string, body: string): void => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), body)
  }

  it('is null when the directory is absent or empty', async () => {
    expect(await readEvidenceMeta(repo)).toBeNull()
    mkdirSync(projectEvidenceDir(repo), { recursive: true })
    expect(await readEvidenceMeta(repo)).toBeNull()
  })

  it('sees a legacy index.html-only pack', async () => {
    writeInto(projectEvidenceDir(repo), 'index.html', '<p>x</p>')
    expect(await readEvidenceMeta(repo)).toMatchObject({ hasReport: true, results: 0, assets: 0 })
  })

  it('sees a checks-only pack (meta.json, no page at all)', async () => {
    const checks: EvidenceCheck[] = [{ label: 'unit', status: 'pass' }]
    writeInto(
      projectEvidenceDir(repo),
      'meta.json',
      JSON.stringify({ title: 'Checks', updatedAt: META_AT, checks }),
    )
    expect(await readEvidenceMeta(repo)).toMatchObject({
      title: 'Checks',
      checks,
      hasReport: false,
      results: 0,
      assets: 0,
    })
  })

  it('sees a results-only pack and counts the documents', async () => {
    writeInto(projectEvidenceResultsDir(repo), 'run-log.md', 'log')
    writeInto(projectEvidenceResultsDir(repo), 'report.html', '<p>x</p>')
    writeInto(projectEvidenceResultsDir(repo), 'notes.txt', 'not a document')
    expect(await readEvidenceMeta(repo)).toMatchObject({
      title: 'Evidence',
      results: 2,
      assets: 0,
      hasReport: false,
    })
  })

  it('sees an assets-only pack and counts the images', async () => {
    writeInto(projectEvidenceAssetsDir(repo), 'shot.png', 'png')
    writeInto(projectEvidenceAssetsDir(repo), 'readme.txt', 'not an image')
    expect(await readEvidenceMeta(repo)).toMatchObject({
      results: 0,
      assets: 1,
      hasReport: false,
    })
  })
})

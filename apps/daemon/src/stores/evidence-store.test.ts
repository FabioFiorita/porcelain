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
  evidenceDirForRepo,
  evidenceOverallStatus,
  MAX_HTML_BYTES,
  readEvidence,
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

  it('surfaces htmlUnavailable when body exceeds the read cap', async () => {
    const huge = 'x'.repeat(MAX_HTML_BYTES + 1)
    writeDisk('Big', huge)
    const evidence = await readEvidence(repo)
    expect(evidence?.html).toBeUndefined()
    expect(evidence?.htmlUnavailable?.reason).toBe('too-large')
    expect(evidence?.title).toBe('Big')
  })

  // A pack the current CLI wrote has no legacy root index.html at all — only
  // results/index.html. An installed client not yet on the Results/Assets split
  // still calls this procedure (loopEvidenceHtml) for the primary report; it
  // must not see "cleared" just because the pack moved one directory down.
  it('falls back to results/index.html when the legacy root is absent', async () => {
    mkdirSync(projectEvidenceDir(repo), { recursive: true })
    mkdirSync(projectEvidenceResultsDir(repo), { recursive: true })
    writeFileSync(join(projectEvidenceResultsDir(repo), 'index.html'), '<h1>results report</h1>')
    writeFileSync(
      join(projectEvidenceDir(repo), 'meta.json'),
      JSON.stringify({ title: 'Results pack', repoPath: repo, updatedAt: META_AT }),
    )
    const evidence = await readEvidence(repo)
    expect(evidence?.html).toBe('<h1>results report</h1>')
    expect(evidence?.title).toBe('Results pack')
  })

  it('inlines a results-report image relative to the evidence root, not results/', async () => {
    mkdirSync(projectEvidenceResultsDir(repo), { recursive: true })
    mkdirSync(projectEvidenceAssetsDir(repo), { recursive: true })
    writeFileSync(join(projectEvidenceAssetsDir(repo), 'shot.png'), 'png-bytes')
    writeFileSync(
      join(projectEvidenceResultsDir(repo), 'index.html'),
      '<img src="../assets/shot.png">',
    )
    const evidence = await readEvidence(repo)
    expect(evidence?.html).toContain('data:image/png;base64,')
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

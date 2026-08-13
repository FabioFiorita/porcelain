// @vitest-environment node
import { existsSync, mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_ASSET_BYTES, MAX_ASSETS } from '../../review/evidence-assets-list'
import { createFsReviewEvidenceStore } from './fs-review-evidence-store'

/**
 * The boundary that owns filesystem risk: a real temporary directory, no daemon and
 * no network. Nothing here reads the human's repositories or channels.
 */

const root = join(tmpdir(), 'porcelain-review-evidence-store-test')
const repo = join(root, 'repo')
const store = createFsReviewEvidenceStore()

const META_AT = '2026-07-17T00:00:00.000Z'

function write(dir: string, name: string, body: string | Buffer): string {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, body)
  return path
}

function writeMeta(data: unknown): void {
  write(projectEvidenceDir(repo), 'meta.json', JSON.stringify(data))
}

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('pack presence', () => {
  it('reads a checks-only pack as a pack with empty results and assets', async () => {
    writeMeta({ title: 'Checks', updatedAt: META_AT, checks: [{ label: 'unit', status: 'pass' }] })

    expect(await store.readPack(repo)).toEqual({
      title: 'Checks',
      updatedAt: META_AT,
      checks: [{ label: 'unit', status: 'pass' }],
      results: [],
      assets: [],
      legacyReport: false,
    })
  })

  it('reads a results-only, an assets-only, and a report-only pack, and an empty directory as null', async () => {
    expect(await store.readPack(repo)).toBeNull()
    mkdirSync(projectEvidenceDir(repo), { recursive: true })
    expect(await store.readPack(repo)).toBeNull()

    write(projectEvidenceResultsDir(repo), 'run-log.md', 'log')
    expect(await store.readPack(repo)).toMatchObject({ results: [{ file: 'run-log.md' }] })

    rmSync(projectEvidenceDir(repo), { recursive: true, force: true })
    write(projectEvidenceAssetsDir(repo), 'shot.png', 'png')
    expect(await store.readPack(repo)).toMatchObject({ assets: [{ file: 'shot.png' }] })

    rmSync(projectEvidenceDir(repo), { recursive: true, force: true })
    write(projectEvidenceDir(repo), 'index.html', '<p>x</p>')
    expect(await store.readPack(repo)).toMatchObject({ legacyReport: true, results: [] })
  })

  it('keeps a half-written meta.json as an empty-checks pack and drops an over-cap checks list', async () => {
    write(projectEvidenceDir(repo), 'meta.json', '{ "title": "Half')
    expect(await store.readPack(repo)).toMatchObject({ title: 'Evidence', checks: [] })

    writeMeta({
      title: 'Too many',
      updatedAt: META_AT,
      checks: Array.from({ length: 40 }, (_, n) => ({ label: `check ${n}`, status: 'pass' })),
    })
    expect(await store.readPack(repo)).toMatchObject({ title: 'Too many', checks: [] })
  })
})

describe('results descriptors', () => {
  it('are name-sorted, cover only results/, and carry file, label, medium, and bytes', async () => {
    write(projectEvidenceResultsDir(repo), 'run-log.md', 'log')
    write(projectEvidenceResultsDir(repo), 'a-report.html', '<p>x</p>')
    write(projectEvidenceResultsDir(repo), 'notes.txt', 'not a document')
    write(projectEvidenceResultsDir(repo), '.hidden.md', 'dotfile')
    write(projectEvidenceDir(repo), 'loose.md', 'root level, not a Results descriptor')

    expect((await store.readPack(repo))?.results).toEqual([
      { file: 'a-report.html', label: 'A report', medium: 'html', bytes: 8 },
      { file: 'run-log.md', label: 'Run log', medium: 'markdown', bytes: 3 },
    ])
  })

  it('never leak a path separator, an absolute path, or a directory member', async () => {
    writeMeta({ title: 'Pack', updatedAt: META_AT })
    write(projectEvidenceResultsDir(repo), 'index.md', '# hi')
    write(projectEvidenceAssetsDir(repo), 'shot.png', 'png')

    const pack = await store.readPack(repo)
    expect(pack).not.toBeNull()
    expect(Object.keys(pack ?? {}).sort()).toEqual([
      'assets',
      'checks',
      'legacyReport',
      'results',
      'title',
      'updatedAt',
    ])
    for (const named of [...(pack?.results ?? []), ...(pack?.assets ?? [])]) {
      for (const value of [named.file, named.label]) {
        expect(value).not.toContain(repo)
        expect(value).not.toMatch(/[\\/]/)
      }
    }
  })

  it('marks a legacy root index.html without adding a results descriptor', async () => {
    write(projectEvidenceDir(repo), 'index.html', '<p>report</p>')

    expect(await store.readPack(repo)).toMatchObject({ legacyReport: true, results: [] })
  })
})

describe('assets gallery', () => {
  it('is the capped, symlink-free gallery list', async () => {
    for (let n = 0; n < MAX_ASSETS + 1; n += 1) {
      write(projectEvidenceAssetsDir(repo), `shot-${String(n).padStart(3, '0')}.png`, 'png')
    }
    const outside = write(root, 'outside.png', 'png')
    symlinkSync(outside, join(projectEvidenceAssetsDir(repo), 'zz-link.png'))

    const pack = await store.readPack(repo)
    expect(pack?.assets).toHaveLength(MAX_ASSETS)
    expect(pack?.assets.map((asset) => asset.file)).not.toContain('zz-link.png')
  })
})

describe('updatedAt', () => {
  it('is the newest of meta, the legacy report, and the files under results/ and assets/', async () => {
    writeMeta({ title: 'Pack', updatedAt: META_AT })
    const reportAt = new Date('2026-07-18T00:00:00.000Z')
    const report = write(projectEvidenceDir(repo), 'index.html', '<p>x</p>')
    utimesSync(report, reportAt, reportAt)
    expect((await store.readPack(repo))?.updatedAt).toBe(reportAt.toISOString())

    const docAt = new Date('2026-07-19T00:00:00.000Z')
    const doc = write(projectEvidenceResultsDir(repo), 'run-log.md', 'log')
    utimesSync(doc, docAt, docAt)
    expect((await store.readPack(repo))?.updatedAt).toBe(docAt.toISOString())
  })

  it('moves when a screenshot is touched without a meta rewrite', async () => {
    writeMeta({ title: 'Pack', updatedAt: META_AT })
    const shot = write(projectEvidenceAssetsDir(repo), 'shot.png', 'png')
    const later = new Date('2026-07-20T00:00:00.000Z')
    utimesSync(shot, later, later)

    expect((await store.readPack(repo))?.updatedAt).toBe(later.toISOString())
  })
})

describe('readAsset', () => {
  it('is null for a traversal, an absolute name, a dotfile, a symlink, a non-image, and an over-cap image', async () => {
    write(projectEvidenceAssetsDir(repo), 'shot.png', 'png-bytes')
    write(projectEvidenceAssetsDir(repo), '.secret.png', 'png')
    write(projectEvidenceAssetsDir(repo), 'notes.txt', 'text')
    write(projectEvidenceAssetsDir(repo), 'huge.png', Buffer.alloc(MAX_ASSET_BYTES + 1))
    const outside = write(root, 'outside.png', 'png')
    symlinkSync(outside, join(projectEvidenceAssetsDir(repo), 'link.png'))

    for (const file of [
      '../../outside.png',
      join(root, 'outside.png'),
      '.secret.png',
      'link.png',
      'notes.txt',
      'huge.png',
      'gone.png',
    ]) {
      expect(await store.readAsset(repo, file)).toBeNull()
    }
  })

  it('returns a data URL for a contained image', async () => {
    write(projectEvidenceAssetsDir(repo), 'shot.png', 'png-bytes')

    expect(await store.readAsset(repo, 'shot.png')).toMatchObject({
      file: 'shot.png',
      mime: 'image/png',
      bytes: 9,
    })
  })
})

describe('readResults', () => {
  it('returns manifest-ordered documents with unique labels and drops an over-cap document', async () => {
    write(projectEvidenceResultsDir(repo), 'index.html', '<p>report</p>')
    write(projectEvidenceResultsDir(repo), 'run-log.md', 'log')
    write(projectEvidenceResultsDir(repo), 'huge.md', 'x'.repeat(2 * 1024 * 1024 + 1))
    write(projectEvidenceDir(repo), 'index.html', '<p>legacy</p>')
    write(
      projectEvidenceResultsDir(repo),
      'meta.json',
      JSON.stringify({ version: 1, tabs: [{ file: 'run-log.md' }, { file: 'index.html' }] }),
    )

    const docs = await store.readResults(repo)
    expect(docs.map((doc) => doc.file)).toEqual(['../index.html', 'run-log.md', 'index.html'])
    expect(new Set(docs.map((doc) => doc.label)).size).toBe(docs.length)
  })
})

describe('clear', () => {
  it('removes the pack directory and succeeds when it is already absent', async () => {
    write(projectEvidenceDir(repo), 'index.html', '<p>x</p>')

    await store.clear(repo)
    expect(existsSync(projectEvidenceDir(repo))).toBe(false)
    await expect(store.clear(repo)).resolves.toBeUndefined()
  })
})

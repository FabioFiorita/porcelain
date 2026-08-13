import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDocSetFile } from '@shared/doc-set-file'
import { INTENT_CANONICAL_TABS, INTENT_MANIFEST, projectIntentDir } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listIntent, orderIntent, prepareIntent } from './intent-file'

let repo = ''

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'porcelain-cli-intent-'))
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

const readManifest = (): { version: number; tabs: Array<{ file: string; label?: string }> } =>
  JSON.parse(readFileSync(join(projectIntentDir(repo), INTENT_MANIFEST), 'utf8'))

describe('intent prepare', () => {
  it('creates the directory and an assets home', () => {
    const prepared = prepareIntent(repo)
    expect(prepared.dir).toBe(projectIntentDir(repo))
    expect(existsSync(prepared.assetsDir)).toBe(true)
  })

  it('seeds the canonical tab order, labels and all', () => {
    expect(prepareIntent(repo).seeded).toBe(true)
    expect(readManifest().tabs).toEqual(INTENT_CANONICAL_TABS.map((tab) => ({ ...tab })))
  })

  // The manifest names files nobody has written yet on purpose: the readers filter
  // against what is on disk, so an unwritten tab is simply not a tab.
  it('seeds the manifest without creating the documents', () => {
    prepareIntent(repo)
    expect(existsSync(join(projectIntentDir(repo), INTENT_MANIFEST))).toBe(true)
    expect(listIntent(repo)).toEqual([])
  })

  it('--tabs replaces the order and gives a bare name .md', () => {
    prepareIntent(repo, ['why', 'measurements.html'])
    expect(readManifest().tabs).toEqual([
      { file: 'why.md', label: 'Why' },
      { file: 'measurements.html', label: 'Measurements' },
    ])
  })

  it('--tabs refuses a path or an empty list', () => {
    expect(() => prepareIntent(repo, ['../secrets'])).toThrow(/plain file names/)
    expect(() => prepareIntent(repo, [])).toThrow(/at least one name/)
  })

  it('is safe to run twice — documents and an existing manifest both survive', () => {
    prepareIntent(repo, ['overview'])
    writeFileSync(join(projectIntentDir(repo), 'index.md'), 'kept')
    const again = prepareIntent(repo)
    expect(again.seeded).toBe(false)
    expect(readFileSync(join(projectIntentDir(repo), 'index.md'), 'utf8')).toBe('kept')
    expect(readManifest().tabs).toEqual([{ file: 'overview.md', label: 'Overview' }])
  })
})

describe('intent list', () => {
  // `intent list` answers "what will the human see as tabs", so the manifest, the
  // assets directory and a dotfile are all noise — the raw readdir printed them.
  it('lists only renderable documents, name-sorted', () => {
    prepareIntent(repo)
    const dir = projectIntentDir(repo)
    writeFileSync(join(dir, 'why.md'), 'why')
    writeFileSync(join(dir, 'before-after.html'), '<p>x</p>')
    writeFileSync(join(dir, 'notes.txt'), 'txt')
    writeFileSync(join(dir, '.DS_Store'), '')
    mkdirSync(join(dir, 'sketches.md'), { recursive: true })
    expect(listIntent(repo)).toEqual(['before-after.html', 'why.md'])
  })

  it('lists a missing directory as empty', () => {
    expect(listIntent(repo)).toEqual([])
  })
})

describe('intent order', () => {
  it('writes the manifest in the given order', () => {
    prepareIntent(repo)
    writeFileSync(join(projectIntentDir(repo), 'a.md'), 'a')
    writeFileSync(join(projectIntentDir(repo), 'b.html'), 'b')
    expect(orderIntent(repo, ['b.html', 'a.md'])).toEqual(['b.html', 'a.md'])
    const manifest = JSON.parse(
      readFileSync(join(projectIntentDir(repo), INTENT_MANIFEST), 'utf8'),
    ) as { tabs: Array<{ file: string }> }
    expect(manifest.tabs.map((t) => t.file)).toEqual(['b.html', 'a.md'])
  })

  it('refuses a document that is not there yet', () => {
    prepareIntent(repo)
    expect(() => orderIntent(repo, ['ghost.md'])).toThrow(/write the documents first/)
  })

  // The manifest is a version-1 document owned by `@shared/doc-set-file` — the
  // same module the daemon parses it with, so the writer cannot drift off the reader.
  it('writes a version-1 manifest', () => {
    prepareIntent(repo)
    writeFileSync(join(projectIntentDir(repo), 'a.md'), 'a')
    orderIntent(repo, ['a.md'])
    expect(readManifest()).toEqual({ version: 1, tabs: [{ file: 'a.md' }] })
  })

  // The drift that cost the pinned order: a label over the daemon's 60-char cap
  // made it drop the whole manifest. The derivation truncates instead.
  it('keeps a derived label inside the 60-char cap', () => {
    const file = `${'long-'.repeat(30)}name.md`
    prepareIntent(repo, [file])
    const label = readManifest().tabs[0]?.label ?? ''
    expect(label.length).toBeLessThanOrEqual(60)
    expect(parseDocSetFile(readManifest())).toEqual(readManifest())
  })

  it('refuses a path instead of a file name', () => {
    prepareIntent(repo)
    expect(() => orderIntent(repo, ['../../etc/passwd'])).toThrow(/plain file names/)
  })

  it('refuses an empty list', () => {
    expect(() => orderIntent(repo, [])).toThrow(/at least one/)
  })
})

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  INTENT_MANIFEST,
  projectEvidenceDir,
  projectEvidenceResultsDir,
} from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readActiveEvidenceResults, readDocSet } from './doc-set'

let dir = ''

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'porcelain-doc-set-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('document sets', () => {
  it('is empty when the directory does not exist', async () => {
    expect(await readDocSet(join(dir, 'nope'))).toEqual([])
  })

  it('picks the medium from the extension and titles from the file name', async () => {
    await writeFile(join(dir, 'index.md'), '# Why')
    await writeFile(join(dir, 'data-flow.html'), '<p>flow</p>')
    const docs = await readDocSet(dir)
    expect(docs.map((d) => [d.file, d.medium, d.label])).toEqual([
      ['data-flow.html', 'html', 'Data flow'],
      ['index.md', 'markdown', 'Index'],
    ])
  })

  it('honours manifest order and puts unlisted files after it', async () => {
    await writeFile(join(dir, 'a.md'), 'a')
    await writeFile(join(dir, 'b.md'), 'b')
    await writeFile(join(dir, 'c.md'), 'c')
    await writeFile(
      join(dir, INTENT_MANIFEST),
      JSON.stringify({ tabs: [{ file: 'c.md', label: 'Last first' }, { file: 'b.md' }] }),
    )
    const docs = await readDocSet(dir)
    expect(docs.map((d) => d.file)).toEqual(['c.md', 'b.md', 'a.md'])
    expect(docs[0]?.label).toBe('Last first')
  })

  it('inlines a stylesheet and an image so html stays on srcdoc', async () => {
    await mkdir(join(dir, 'assets'), { recursive: true })
    await writeFile(join(dir, 'assets', 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(dir, 'index.css'), 'body { color: red }')
    await writeFile(
      join(dir, 'index.html'),
      '<link rel="stylesheet" href="index.css"><img src="assets/shot.png">',
    )
    const [doc] = await readDocSet(dir)
    expect(doc?.body).toContain('<style')
    expect(doc?.body).toContain('color: red')
    expect(doc?.body).toContain('data:image/png;base64,')
    // Never a URL — a srcdoc document inherits the parent CSP; a src= one does not.
    expect(doc?.body).not.toContain('href="index.css"')
  })

  it('ignores files it cannot render', async () => {
    await writeFile(join(dir, 'notes.txt'), 'nope')
    await writeFile(join(dir, 'script.js'), 'alert(1)')
    await writeFile(join(dir, 'index.md'), 'yes')
    expect((await readDocSet(dir)).map((d) => d.file)).toEqual(['index.md'])
  })

  // A scene left behind by an older agent is not a medium any client can draw.
  // It is skipped like any other unknown extension — the rest of the tabs stand.
  it('skips a legacy scene file without failing the directory', async () => {
    await writeFile(join(dir, 'board.excalidraw'), JSON.stringify({ elements: [] }))
    await writeFile(join(dir, 'index.md'), 'yes')
    expect((await readDocSet(dir)).map((d) => d.file)).toEqual(['index.md'])
  })

  it('refuses a manifest entry that tries to walk out of the directory', async () => {
    await writeFile(join(dir, 'index.md'), 'ok')
    await writeFile(
      join(dir, INTENT_MANIFEST),
      JSON.stringify({ tabs: [{ file: '../../../etc/passwd' }, { file: 'index.md' }] }),
    )
    expect((await readDocSet(dir)).map((d) => d.file)).toEqual(['index.md'])
  })

  it('drops an oversized document instead of throwing', async () => {
    await writeFile(join(dir, 'huge.md'), 'x'.repeat(3 * 1024 * 1024))
    await writeFile(join(dir, 'index.md'), 'small')
    expect((await readDocSet(dir)).map((d) => d.file)).toEqual(['index.md'])
  })
})

describe('assetRoot', () => {
  it('inlines an image one level up when it stays inside the root', async () => {
    const docs = join(dir, 'results')
    await mkdir(join(dir, 'assets'), { recursive: true })
    await mkdir(docs, { recursive: true })
    await writeFile(join(dir, 'assets', 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(docs, 'report.html'), '<img src="../assets/shot.png">')
    const [doc] = await readDocSet(docs, { assetRoot: dir })
    expect(doc?.body).toContain('data:image/png;base64,')
  })

  it('still refuses a reference that escapes the root', async () => {
    const docs = join(dir, 'results')
    await mkdir(docs, { recursive: true })
    await writeFile(join(dir, 'outside.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(docs, 'report.html'), '<img src="../../outside.png">')
    const [doc] = await readDocSet(docs, { assetRoot: docs })
    expect(doc?.body).toBe('<img src="../../outside.png">')
  })

  it('leaves a sibling out of reach when the root is the doc directory', async () => {
    const docs = join(dir, 'results')
    await mkdir(docs, { recursive: true })
    await writeFile(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(join(docs, 'report.html'), '<img src="../shot.png">')
    const [doc] = await readDocSet(docs)
    expect(doc?.body).not.toContain('data:image')
  })
})

describe('alsoScan', () => {
  it('picks up documents from an extra directory, after the primary one', async () => {
    const docs = join(dir, 'results')
    await mkdir(docs, { recursive: true })
    await writeFile(join(docs, 'b.md'), 'from results')
    await writeFile(join(dir, 'a.md'), 'loose at the root')
    const set = await readDocSet(docs, { alsoScan: [dir] })
    expect(set.map((d) => d.file)).toEqual(['b.md', 'a.md'])
    expect(set[1]?.body).toBe('loose at the root')
  })

  it('never surfaces an excluded name from an extra directory', async () => {
    const docs = join(dir, 'results')
    await mkdir(docs, { recursive: true })
    await writeFile(join(dir, 'index.html'), '<p>legacy</p>')
    await writeFile(join(dir, 'run-log.md'), 'log')
    const set = await readDocSet(docs, { alsoScan: [dir], excludeFromAlsoScan: ['index.html'] })
    expect(set.map((d) => d.file)).toEqual(['run-log.md'])
  })

  // The exclusion exists to stop the legacy root report being listed twice. It
  // must never reach the primary directory, where `index.html` is just the most
  // obvious name for a modern report.
  it('keeps a primary-directory file the extra directories exclude', async () => {
    const docs = join(dir, 'results')
    await mkdir(docs, { recursive: true })
    await writeFile(join(docs, 'index.html'), '<p>modern</p>')
    await writeFile(join(dir, 'index.html'), '<p>legacy</p>')
    const set = await readDocSet(docs, { alsoScan: [dir], excludeFromAlsoScan: ['index.html'] })
    expect(set.map((d) => d.file)).toEqual(['index.html'])
    expect(set[0]?.body).toBe('<p>modern</p>')
  })
})

describe('readActiveEvidenceResults', () => {
  const repo = (): string => join(dir, 'repo')

  it('reads results/ documents with the evidence dir as the asset root', async () => {
    const results = projectEvidenceResultsDir(repo())
    await mkdir(join(projectEvidenceDir(repo()), 'assets'), { recursive: true })
    await mkdir(results, { recursive: true })
    await writeFile(
      join(projectEvidenceDir(repo()), 'assets', 'shot.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    )
    await writeFile(join(results, 'report.html'), '<img src="../assets/shot.png">')
    const docs = await readActiveEvidenceResults(repo())
    expect(docs.map((d) => d.file)).toEqual(['report.html'])
    expect(docs[0]?.body).toContain('data:image/png;base64,')
  })

  // "Index" is a file name, not a name a human gave the tab; the legacy root file
  // has always read "Report" and this is the same document one directory down.
  it('renders results/index.html as "Report" — the exclusion is for the legacy root only', async () => {
    const results = projectEvidenceResultsDir(repo())
    await mkdir(results, { recursive: true })
    await writeFile(join(results, 'index.html'), '<p>modern report</p>')
    const docs = await readActiveEvidenceResults(repo())
    expect(docs.map((d) => [d.file, d.label])).toEqual([['index.html', 'Report']])
    expect(docs[0]?.body).toBe('<p>modern report</p>')
  })

  it('lets a manifest label beat the derived "Report"', async () => {
    const results = projectEvidenceResultsDir(repo())
    await mkdir(results, { recursive: true })
    await writeFile(join(results, 'index.html'), '<p>modern report</p>')
    await writeFile(
      join(results, INTENT_MANIFEST),
      JSON.stringify({ tabs: [{ file: 'index.html', label: 'Sim loop' }] }),
    )
    const docs = await readActiveEvidenceResults(repo())
    expect(docs.map((d) => [d.file, d.label])).toEqual([['index.html', 'Sim loop']])
  })

  it('renders both index.html files, with distinct keys and distinct labels', async () => {
    const results = projectEvidenceResultsDir(repo())
    await mkdir(results, { recursive: true })
    await writeFile(join(projectEvidenceDir(repo()), 'index.html'), '<p>old proof</p>')
    await writeFile(join(results, 'index.html'), '<p>modern report</p>')
    const docs = await readActiveEvidenceResults(repo())
    expect(docs.map((d) => [d.file, d.label])).toEqual([
      ['../index.html', 'Earlier report'],
      ['index.html', 'Report'],
    ])
    expect(docs.map((d) => d.body)).toEqual(['<p>old proof</p>', '<p>modern report</p>'])
    expect(new Set(docs.map((d) => d.file)).size).toBe(docs.length)
  })

  it('surfaces a legacy index.html first, as "Report"', async () => {
    const results = projectEvidenceResultsDir(repo())
    await mkdir(results, { recursive: true })
    await writeFile(join(projectEvidenceDir(repo()), 'index.html'), '<p>old proof</p>')
    await writeFile(join(results, 'run-log.md'), 'log')
    const docs = await readActiveEvidenceResults(repo())
    expect(docs.map((d) => [d.file, d.label])).toEqual([
      ['index.html', 'Report'],
      ['run-log.md', 'Run log'],
    ])
  })

  it('keeps rendering loose documents left at the evidence root', async () => {
    await mkdir(projectEvidenceDir(repo()), { recursive: true })
    await writeFile(join(projectEvidenceDir(repo()), 'notes.md'), 'legacy note')
    expect((await readActiveEvidenceResults(repo())).map((d) => d.file)).toEqual(['notes.md'])
  })

  it('is empty when there is no evidence at all', async () => {
    expect(await readActiveEvidenceResults(repo())).toEqual([])
  })
})

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { INTENT_MANIFEST } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkEvidence,
  clearEvidence,
  describeEvidence,
  evidenceDirForRepo,
  getEvidence,
  listAssets,
  listResults,
  orderResults,
  prepareEvidence,
  setEvidence,
} from './evidence-file'

const root = join(tmpdir(), 'porcelain-evidence-file-test')
const repo = join(root, 'repo')

beforeEach(() => {
  rmSync(root, { recursive: true, force: true })
  mkdirSync(repo, { recursive: true })
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('evidence directory channel', () => {
  it('prepareEvidence creates the three parts + meta, and no document', () => {
    const { dir, resultsDir, assetsDir, title } = prepareEvidence(repo, 'Loop')
    expect(title).toBe('Loop')
    expect(dir).toBe(evidenceDirForRepo(repo))
    expect(existsSync(join(dir, 'meta.json'))).toBe(true)
    expect(existsSync(resultsDir)).toBe(true)
    expect(existsSync(assetsDir)).toBe(true)
    expect(existsSync(join(resultsDir, 'index.html'))).toBe(false)
  })

  it('agent can Write results/index.html after prepare and getEvidence sees it', () => {
    const { resultsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(resultsDir, 'index.html'), '<h1>ok</h1>')
    expect(getEvidence(repo)?.html).toBe('<h1>ok</h1>')
    expect(getEvidence(repo)?.file).toBe('results/index.html')
  })

  // A pack written before Evidence had sub-tabs is still proof; `get` must still find it.
  it('getEvidence still reads a legacy root index.html', () => {
    prepareEvidence(repo, 'Loop')
    writeFileSync(join(evidenceDirForRepo(repo), 'index.html'), '<h1>legacy</h1>')
    expect(getEvidence(repo)?.html).toBe('<h1>legacy</h1>')
    expect(getEvidence(repo)?.file).toBe('index.html')
  })

  it('setEvidence writes results/index.html, never the legacy root file', () => {
    const e = setEvidence(repo, 'T', '<p>hi</p>')
    expect(e.dir).toBe(evidenceDirForRepo(repo))
    expect(e.file).toBe('results/index.html')
    expect(readFileSync(join(e.dir, 'results', 'index.html'), 'utf8')).toBe('<p>hi</p>')
    expect(existsSync(join(e.dir, 'index.html'))).toBe(false)
  })

  it('clearEvidence removes the directory', () => {
    setEvidence(repo, 'T', '<p>hi</p>')
    clearEvidence(repo)
    expect(existsSync(evidenceDirForRepo(repo))).toBe(false)
  })

  it('checkEvidence creates the meta when missing', () => {
    const r = checkEvidence(repo, 'unit', 'pass', undefined)
    expect(r.title).toBe('Evidence')
    expect(r.checks).toHaveLength(1)
  })

  it('checkEvidence appends distinct checks and keeps the prepared title', () => {
    prepareEvidence(repo, 'Loop')
    checkEvidence(repo, 'a', 'pass', undefined)
    checkEvidence(repo, 'b', 'fail', 'nope')
    const r = checkEvidence(repo, 'c', 'skip', undefined)
    expect(r.title).toBe('Loop')
    expect(r.checks.map((c) => c.label)).toEqual(['a', 'b', 'c'])
  })

  it('checkEvidence replaces a check with the same label', () => {
    checkEvidence(repo, 'a', 'fail', undefined)
    const r = checkEvidence(repo, 'a', 'pass', undefined)
    expect(r.checks).toHaveLength(1)
    expect(r.checks[0]?.status).toBe('pass')
  })

  it('describeEvidence points at the directory when index exists', () => {
    setEvidence(repo, 'T', '<p>preview me</p>')
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toContain('preview me')
    expect(text).toContain(evidenceDirForRepo(repo))
  })

  it('describeEvidence includes the checks summary', () => {
    setEvidence(repo, 'T', '<p>x</p>')
    checkEvidence(repo, 'unit', 'pass', undefined)
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toMatch(/Checks:|pass/i)
  })

  it('prepareEvidence wipes prior documents', () => {
    setEvidence(repo, 'Old', '<p>old</p>')
    prepareEvidence(repo, 'New')
    expect(listResults(repo)).toEqual([])
  })

  it('setEvidence replaces the pack so old screenshots cannot linger', () => {
    const { assetsDir } = prepareEvidence(repo, 'A')
    writeFileSync(join(assetsDir, 'shot.png'), 'png')
    setEvidence(repo, 'B', '<p>2</p>')
    expect(listAssets(repo)).toEqual([])
  })
})

describe('evidence results — the document set', () => {
  it('orderResults writes the manifest in the given order', () => {
    const { resultsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(resultsDir, 'a.md'), 'a')
    writeFileSync(join(resultsDir, 'b.html'), 'b')
    expect(orderResults(repo, ['b.html', 'a.md'])).toEqual(['b.html', 'a.md'])
    const manifest = JSON.parse(readFileSync(join(resultsDir, INTENT_MANIFEST), 'utf8')) as {
      tabs: Array<{ file: string }>
    }
    expect(manifest.tabs.map((t) => t.file)).toEqual(['b.html', 'a.md'])
    // Atomic: the tmp file never survives a successful write.
    expect(existsSync(join(resultsDir, `${INTENT_MANIFEST}.tmp`))).toBe(false)
  })

  it('orderResults refuses a document that is not there yet', () => {
    prepareEvidence(repo, 'Loop')
    expect(() => orderResults(repo, ['ghost.md'])).toThrow(/write the documents first/)
  })

  it('orderResults refuses a path instead of a file name', () => {
    prepareEvidence(repo, 'Loop')
    expect(() => orderResults(repo, ['../../etc/passwd'])).toThrow(/plain file names/)
  })

  it('listResults lists what is on disk, name-sorted', () => {
    const { resultsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(resultsDir, 'b.md'), 'b')
    writeFileSync(join(resultsDir, 'a.md'), 'a')
    expect(listResults(repo)).toEqual(['a.md', 'b.md'])
  })

  // The list answers "what will the human see as tabs" — the manifest, an assets
  // directory and a stray log are none of them.
  it('listResults lists only renderable documents', () => {
    const { resultsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(resultsDir, 'why.md'), 'why')
    writeFileSync(join(resultsDir, 'report.html'), '<p>r</p>')
    writeFileSync(join(resultsDir, 'run.log'), 'log')
    writeFileSync(join(resultsDir, '.hidden.md'), 'nope')
    orderResults(repo, ['why.md'])
    mkdirSync(join(resultsDir, 'assets'), { recursive: true })
    expect(listResults(repo)).toEqual(['report.html', 'why.md'])
  })
})

describe('evidence assets — the gallery', () => {
  it('lists images with sizes and no warning', () => {
    const { assetsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(assetsDir, 'before.png'), 'x'.repeat(1024))
    const assets = listAssets(repo)
    expect(assets).toEqual([{ file: 'before.png', bytes: 1024 }])
  })

  it('warns about a non-image the gallery will skip', () => {
    const { assetsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(assetsDir, 'run.log'), 'log')
    expect(listAssets(repo)[0]?.warning).toMatch(/not an image/)
  })

  it('warns about an image over the per-image cap', () => {
    const { assetsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(assetsDir, 'huge.png'), Buffer.alloc(8 * 1024 * 1024 + 1))
    expect(listAssets(repo)[0]?.warning).toMatch(/per-image cap/)
  })

  it('describeEvidence reports the Results tabs, the gallery count, and the warnings', () => {
    const { resultsDir, assetsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(resultsDir, 'index.html'), '<p>ok</p>')
    writeFileSync(join(assetsDir, 'shot.png'), 'png')
    writeFileSync(join(assetsDir, 'run.log'), 'log')
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toContain('Results: 1 document(s): index.html')
    expect(text).toContain('Assets: 1 image(s) in the gallery')
    expect(text).toContain('run.log')
  })

  // The report looks finished and the human sees a broken image — `get` is the
  // last place an agent can catch it.
  it('describeEvidence warns about a Results ref with nothing behind it', () => {
    const { resultsDir, assetsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(join(assetsDir, 'here.png'), 'png')
    writeFileSync(
      join(resultsDir, 'index.html'),
      '<img src="../assets/here.png"><img src="../assets/gone.png">',
    )
    const text = describeEvidence(repo, getEvidence(repo))
    expect(text).toContain('WARNING: results/index.html references ../assets/gone.png')
    expect(text).not.toContain('here.png, which is not on disk')
  })

  it('describeEvidence leaves remote and out-of-pack refs alone', () => {
    const { resultsDir } = prepareEvidence(repo, 'Loop')
    writeFileSync(
      join(resultsDir, 'index.html'),
      '<img src="https://example.com/a.png"><img src="../../../../secrets.png">',
    )
    expect(describeEvidence(repo, getEvidence(repo))).not.toContain('not on disk')
  })
})

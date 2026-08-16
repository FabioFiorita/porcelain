import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildReviewCanvas, renderReviewGallery, writeReviewCanvasBundle } from './review-canvas'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Review Canvas template', () => {
  it('builds one entry and four addressable sections from Markdown bodies', () => {
    const bundle = buildReviewCanvas({
      title: 'A <safe> review',
      kind: 'markdown',
      bodies: { intent: 'why', process: 'how', execution: 'what', evidence: 'proof' },
    })

    expect(bundle.entryFile).toBe('index.md')
    expect(bundle.entryContent).toContain('## Intent\n\nwhy')
    expect(bundle.sections.map((section) => section.file)).toEqual([
      'sections/intent.md',
      'sections/process.md',
      'sections/execution.md',
      'sections/evidence.md',
    ])
  })

  it('writes sections and keeps gallery references inside assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'porcelain-review-canvas-'))
    roots.push(root)
    const asset = join(root, 'capture.png')
    await writeFile(asset, 'png')
    const bundleDir = join(root, 'bundle')
    const bundle = buildReviewCanvas({
      title: 'Review',
      kind: 'html',
      bodies: { intent: '<p>why</p>', process: '', execution: '', evidence: '' },
    })
    await writeReviewCanvasBundle(bundleDir, bundle, [{ name: 'capture.png', path: asset }])

    expect(await readFile(join(bundleDir, 'sections', 'process.html'), 'utf8')).toContain(
      'Nothing was recorded',
    )
    expect(await readFile(join(bundleDir, 'assets', 'capture.png'), 'utf8')).toBe('png')
    expect(renderReviewGallery([{ name: 'x&.png', path: asset }], 'html')).toContain(
      'assets/x&amp;.png',
    )
  })
})

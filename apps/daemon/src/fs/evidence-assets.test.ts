import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inlineLocalAssets } from './evidence-assets'

describe('inlineLocalAssets', () => {
  const dir = join(tmpdir(), 'porcelain-evidence-assets-test')

  beforeEach(() => {
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rewrites a relative png src to a data URI', async () => {
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<img src="shot.png" alt="x">'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toMatch(/src="data:image\/png;base64,/)
    expect(out).not.toContain('src="shot.png"')
  })

  it('inlines a relative stylesheet link for sandboxed HTML', async () => {
    writeFileSync(join(dir, 'styles.css'), 'body { background: #123456; }')
    const html = '<link rel="stylesheet" href="styles.css"><p>hello</p>'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toContain('<style data-porcelain-inlined-stylesheet="true">')
    expect(out).toContain('body { background: #123456; }')
    expect(out).not.toContain('<link rel="stylesheet" href="styles.css">')
  })

  it('leaves remote and missing stylesheets alone', async () => {
    const html =
      '<link rel="stylesheet" href="https://example.com/styles.css"><link rel="stylesheet" href="missing.css">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })

  it('leaves data: and https: src alone', async () => {
    const html = '<img src="data:image/png;base64,xx"><img src="https://x/y.png">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })

  it('does not escape the evidence directory', async () => {
    const html = '<img src="../../etc/passwd">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })

  it('rejects a reference that escapes without a leading ..', async () => {
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<img src="sub/../../shot.png">'
    expect(await inlineLocalAssets(join(dir, 'sub'), html)).toBe(html)
  })

  // A Results document sits one level below the pack root and points at the
  // gallery the Assets tab lists — so the pack keeps one copy of each image.
  it('inlines ../assets when the root is the directory above', async () => {
    mkdirSync(join(dir, 'assets'), { recursive: true })
    mkdirSync(join(dir, 'results'), { recursive: true })
    writeFileSync(join(dir, 'assets', 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<img src="../assets/shot.png">'
    const out = await inlineLocalAssets(join(dir, 'results'), html, dir)
    expect(out).toMatch(/src="data:image\/png;base64,/)
  })

  it('still refuses to climb above the root', async () => {
    mkdirSync(join(dir, 'results'), { recursive: true })
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<img src="../../shot.png">'
    expect(await inlineLocalAssets(join(dir, 'results'), html, dir)).toBe(html)
  })
})

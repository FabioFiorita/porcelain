import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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

  it('inlines a relative video source for a sandboxed HTML document', async () => {
    writeFileSync(join(dir, 'capture.mp4'), Buffer.from('video-bytes'))
    const html = '<video controls src="capture.mp4"></video>'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toMatch(/src="data:video\/mp4;base64,/)
    expect(out).not.toContain('src="capture.mp4"')
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

  it('does not false-positive ..foo filenames as outside', async () => {
    writeFileSync(join(dir, '..foo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<img src="..foo.png">'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toMatch(/src="data:image\/png;base64,/)
  })

  it('leaves image symlink escape alone but inlines contained symlink', async () => {
    const outside = join(tmpdir(), 'porcelain-evidence-assets-outside')
    rmSync(outside, { recursive: true, force: true })
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'secret.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    symlinkSync(join(outside, 'secret.png'), join(dir, 'escape.png'))
    writeFileSync(join(dir, 'real.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    symlinkSync(join(dir, 'real.png'), join(dir, 'ok-link.png'))

    const escaped = '<img src="escape.png">'
    expect(await inlineLocalAssets(dir, escaped)).toBe(escaped)

    const contained = '<img src="ok-link.png">'
    expect(await inlineLocalAssets(dir, contained)).toMatch(/src="data:image\/png;base64,/)

    rmSync(outside, { recursive: true, force: true })
  })

  it('MIME identity follows lexical name when contained symlink target extension differs', async () => {
    // Lexical entry ends in .png; real target has no image extension — MIME must stay image/png.
    writeFileSync(join(dir, 'payload.bin'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    symlinkSync(join(dir, 'payload.bin'), join(dir, 'shot.png'))
    const html = '<img src="shot.png" alt="x">'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toMatch(/src="data:image\/png;base64,/)
    expect(out).not.toContain('application/octet-stream')
  })

  it('leaves stylesheet symlink escape alone', async () => {
    const outside = join(tmpdir(), 'porcelain-evidence-assets-css-outside')
    rmSync(outside, { recursive: true, force: true })
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'evil.css'), 'body{color:red}')
    symlinkSync(join(outside, 'evil.css'), join(dir, 'escape.css'))
    const html = '<link rel="stylesheet" href="escape.css">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
    rmSync(outside, { recursive: true, force: true })
  })

  it('leaves a script tag alone by default — inlineScripts opts in', async () => {
    writeFileSync(join(dir, 'app.js'), 'console.log("hi")')
    const html = '<script src="app.js"></script>'
    // Normal document readers use a sandbox with no allow-scripts, so the
    // default must leave scripts exactly as authored, never inline them.
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })

  it('inlines an empty external script tag as inline JS text when opted in', async () => {
    writeFileSync(join(dir, 'app.js'), 'console.log("hi")')
    const html = '<script src="app.js"></script>'
    const out = await inlineLocalAssets(dir, html, dir, true)
    expect(out).toBe('<script>console.log("hi")</script>')
  })

  it('escapes a literal closing tag inside inlined script text', async () => {
    writeFileSync(join(dir, 'app.js'), 'document.write("</script><script>evil()</script>")')
    const out = await inlineLocalAssets(dir, '<script src="app.js"></script>', dir, true)
    expect(out).toBe('<script>document.write("<\\/script><script>evil()<\\/script>")</script>')
  })

  it('leaves a script tag with a body untouched even when it also has src', async () => {
    writeFileSync(join(dir, 'app.js'), 'console.log("hi")')
    const html = '<script src="app.js">// ignored by the browser anyway</script>'
    expect(await inlineLocalAssets(dir, html, dir, true)).toBe(html)
  })

  it('leaves remote and missing scripts alone', async () => {
    const html =
      '<script src="https://example.com/app.js"></script><script src="missing.js"></script>'
    expect(await inlineLocalAssets(dir, html, dir, true)).toBe(html)
  })

  it('leaves a script symlink escape alone', async () => {
    const outside = join(tmpdir(), 'porcelain-evidence-assets-js-outside')
    rmSync(outside, { recursive: true, force: true })
    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'evil.js'), 'evil()')
    symlinkSync(join(outside, 'evil.js'), join(dir, 'escape.js'))
    const html = '<script src="escape.js"></script>'
    expect(await inlineLocalAssets(dir, html, dir, true)).toBe(html)
    rmSync(outside, { recursive: true, force: true })
  })

  it('inlines an image sibling to an already-inlined script with no double-processing', async () => {
    writeFileSync(join(dir, 'app.js'), 'noop()')
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<script src="app.js"></script><img src="shot.png">'
    const out = await inlineLocalAssets(dir, html, dir, true)
    expect(out).toContain('<script>noop()</script>')
    expect(out).toMatch(/<img src="data:image\/png;base64,[^"]+">/)
    expect(out).not.toContain('src="app.js"')
  })

  it('still excludes an untouched (inlineScripts=false) script src from the generic image pass', async () => {
    writeFileSync(join(dir, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const html = '<script src="app.js"></script><img src="shot.png">'
    const out = await inlineLocalAssets(dir, html)
    expect(out).toContain('<script src="app.js"></script>')
    expect(out).toMatch(/<img src="data:image\/png;base64,[^"]+">/)
  })
})

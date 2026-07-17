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

  it('leaves data: and https: src alone', async () => {
    const html = '<img src="data:image/png;base64,xx"><img src="https://x/y.png">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })

  it('does not escape the evidence directory', async () => {
    const html = '<img src="../../etc/passwd">'
    expect(await inlineLocalAssets(dir, html)).toBe(html)
  })
})

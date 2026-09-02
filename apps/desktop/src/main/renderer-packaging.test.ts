import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webViteConfig = resolve(__dirname, '../../../web/vite.config.ts')
const webLogo = resolve(__dirname, '../../../web/src/assets/logo.png')
const builtIndex = resolve(__dirname, '../../out/renderer/index.html')
const builtAssets = resolve(__dirname, '../../out/renderer/assets')
const electronBuilderYml = resolve(__dirname, '../../electron-builder.yml')
const afterPack = resolve(__dirname, '../../build/after-pack.js')

describe('renderer packaging (file:// safe base)', () => {
  it("apps/web vite sets base: './'", () => {
    expect(readFileSync(webViteConfig, 'utf8')).toMatch(/\bbase:\s*['"]\.\/['"]/)
  })

  it('built index.html uses relative asset URLs when dist is present', () => {
    if (!existsSync(builtIndex)) return
    const html = readFileSync(builtIndex, 'utf8')
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '')
    expect(refs.some((h) => h.includes('assets/'))).toBe(true)
    for (const href of refs) {
      if (href.startsWith('http') || href.startsWith('data:')) continue
      expect(href.startsWith('/'), `absolute root URL breaks file://: ${href}`).toBe(false)
    }
  })

  it('keeps the app logo compact and emits only the terminal-owned Symbols font', () => {
    const logo = readFileSync(webLogo)
    // PNG IHDR: signature (8 bytes), chunk length/type (8 bytes), then width and height.
    expect(logo.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect(logo.readUInt32BE(16)).toBeLessThanOrEqual(160)
    expect(logo.readUInt32BE(20)).toBeLessThanOrEqual(176)
    expect(statSync(webLogo).size).toBeLessThanOrEqual(40 * 1024)

    if (!existsSync(builtAssets)) return
    const emittedSymbolsFonts = readdirSync(builtAssets).filter((name) =>
      name.startsWith('SymbolsNerdFontMono-Regular-'),
    )
    expect(emittedSymbolsFonts).toHaveLength(1)
    expect(emittedSymbolsFonts[0]).toMatch(/\.woff2$/)
  })

  it('asarUnpack lists node-pty and trash', () => {
    const yml = readFileSync(electronBuilderYml, 'utf8')
    expect(yml).toContain('node_modules/node-pty/**')
    expect(yml).toContain('node_modules/trash/**')
  })

  it('configures an x64 NSIS installer with signed-update verification', () => {
    const yml = readFileSync(electronBuilderYml, 'utf8')
    const fuseHook = readFileSync(afterPack, 'utf8')
    expect(yml).toMatch(/win:\s+[\s\S]*target:\s+[\s\S]*target: nsis/)
    expect(yml).toMatch(/arch: \[x64\]/)
    expect(yml).toContain('verifyUpdateCodeSignature: true')
    expect(yml).toMatch(/nsis:\s+[\s\S]*artifactName:/)
    expect(fuseHook).toContain("['darwin', 'linux', 'win32']")
    expect(fuseHook).toContain("electronPlatformName === 'win32' ? '.exe' : ''")
  })
})

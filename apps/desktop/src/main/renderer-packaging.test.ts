import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webViteConfig = resolve(__dirname, '../../../web/vite.config.ts')
const webLogo = resolve(__dirname, '../../../web/src/assets/logo.png')
const builtIndex = resolve(__dirname, '../../out/renderer/index.html')
const builtAssets = resolve(__dirname, '../../out/renderer/assets')
const electronBuilderYml = resolve(__dirname, '../../electron-builder.yml')
const electronBuilderUnsignedYml = resolve(__dirname, '../../electron-builder.unsigned.yml')
const afterPack = resolve(__dirname, '../../build/after-pack.js')
const desktopPackageJson = resolve(__dirname, '../../package.json')
const releaseWorkflow = resolve(__dirname, '../../../../.github/workflows/release.yml')
const releaseFuseSmoke = resolve(__dirname, '../../../../scripts/release-fuse-smoke.mjs')
const releasePublish = resolve(__dirname, '../../../../scripts/release-publish.mjs')

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
    expect(yml).toContain('signingHashAlgorithms: [sha256]')
    expect(yml).toContain('verifyUpdateCodeSignature: true')
    expect(yml).toMatch(/nsis:\s+[\s\S]*artifactName:/)
    expect(fuseHook).toContain("['darwin', 'linux', 'win32']")
    expect(fuseHook).toContain("electronPlatformName === 'win32' ? '.exe' : ''")
  })

  it('keeps macOS signing mandatory while making Windows signing an explicit two-mode release', () => {
    const workflow = readFileSync(releaseWorkflow, 'utf8')
    const unsignedConfig = readFileSync(electronBuilderUnsignedYml, 'utf8')
    const desktopPackage = JSON.parse(readFileSync(desktopPackageJson, 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(workflow).toContain('Require macOS signing and notarization credentials')
    expect(workflow).toContain('xcrun notarytool submit "$dmg"')
    expect(workflow).toContain('xcrun stapler staple "$dmg"')
    expect(workflow).toContain('xcrun stapler validate "$dmg"')
    expect(workflow).toContain('run: node scripts/windows-signing-mode.mjs')
    expect(workflow).toContain("if: steps.windows_signing.outputs.enabled == 'true'")
    expect(workflow).toContain("if: steps.windows_signing.outputs.enabled == 'false'")
    expect(workflow).toContain('run: pnpm package:win:unsigned')
    expect(workflow).toContain("CSC_IDENTITY_AUTO_DISCOVERY: 'false'")
    expect(workflow).toContain("$signature.Status -ne 'NotSigned'")
    expect(desktopPackage.scripts['package:win:unsigned']).toContain(
      '--config electron-builder.unsigned.yml',
    )
    expect(unsignedConfig).toContain('extends: ./electron-builder.yml')
    expect(unsignedConfig).toContain('signExecutable: false')
    expect(unsignedConfig).toContain('verifyUpdateCodeSignature: false')
  })

  it('checks that Windows update metadata identifies and hashes the shipped installer', () => {
    const smoke = readFileSync(releaseFuseSmoke, 'utf8')
    expect(smoke).toContain("createHash('sha512')")
    expect(smoke).toContain('metadataPath !== installer')
    expect(smoke).toContain('metadataSha512 !== installerSha512')
  })

  it('publishes from the existing immutable tag without retargeting it', () => {
    const workflow = readFileSync(releaseWorkflow, 'utf8')
    const publish = readFileSync(releasePublish, 'utf8')
    expect(workflow).toMatch(/ref:\s*\$\{\{\s*github\.sha\s*\}\}/)
    expect(publish).toContain("? ['--verify-tag']")
    expect(publish).toContain("['--target', target]")
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type CodexPluginManifest = {
  interface: { composerIcon: string; logo: string }
}

const pluginRoot = resolve(__dirname, '../../../../plugins/porcelain')

describe('Codex plugin branding', () => {
  it('uses the compact Porcelain app icon in the composer', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(pluginRoot, '.codex-plugin/plugin.json'), 'utf8'),
    ) as CodexPluginManifest

    expect(manifest.interface.composerIcon).toBe('./assets/composer-icon.png')
    expect(manifest.interface.logo).toBe('./assets/icon.png')
    expect(
      readFileSync(resolve(pluginRoot, 'assets/composer-icon.png')).equals(
        readFileSync(resolve(__dirname, '../../../web/src/assets/logo.png')),
      ),
    ).toBe(true)
  })
})

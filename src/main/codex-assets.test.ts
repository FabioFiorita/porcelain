import { describe, expect, it } from 'vitest'
import {
  CODEX_MARKETPLACE_NAME,
  codexInstallCommands,
  codexMarketplaceDir,
  codexMarketplaceManifest,
  codexMcpManifest,
  codexPluginManifest,
} from './codex-assets'
import { PLUGIN_NAME } from './plugin-assets'

describe('codex assets', () => {
  it('marketplace points at the local porcelain plugin source', () => {
    const manifest = codexMarketplaceManifest()
    expect(manifest.name).toBe(CODEX_MARKETPLACE_NAME)
    expect(manifest.plugins).toEqual([
      expect.objectContaining({
        name: PLUGIN_NAME,
        source: { source: 'local', path: './plugins/porcelain' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      }),
    ])
  })

  it('plugin manifest declares skills and the MCP companion file', () => {
    const manifest = codexPluginManifest('1.2.3')
    expect(manifest).toMatchObject({
      name: PLUGIN_NAME,
      version: '1.2.3',
      skills: './skills/',
      mcpServers: './.mcp.json',
    })
  })

  it('MCP manifest launches the bundled server from the plugin root', () => {
    expect(codexMcpManifest()).toEqual({
      mcpServers: {
        porcelain: {
          command: 'node',
          args: ['./server.js'],
        },
      },
    })
  })

  it('install commands drop any prior install then re-add so a re-run upgrades the snapshot', () => {
    expect(codexInstallCommands()).toEqual([
      `codex plugin remove porcelain@${CODEX_MARKETPLACE_NAME} || true`,
      `codex plugin marketplace remove ${CODEX_MARKETPLACE_NAME} || true`,
      `codex plugin marketplace add ${codexMarketplaceDir()}`,
      `codex plugin add porcelain@${CODEX_MARKETPLACE_NAME}`,
    ])
  })
})

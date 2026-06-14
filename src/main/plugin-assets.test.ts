import { describe, expect, it } from 'vitest'
import {
  installCommands,
  MARKETPLACE_NAME,
  marketplaceManifest,
  PLUGIN_NAME,
  pluginManifest,
  pluginMarketplaceDir,
  REVIEW_SKILL,
} from './plugin-assets'

describe('plugin assets', () => {
  it('marketplace lists the porcelain plugin by relative source', () => {
    const m = marketplaceManifest()
    expect(m.name).toBe(MARKETPLACE_NAME)
    expect(m.owner).toMatchObject({ name: expect.any(String) })
    expect(m.plugins).toEqual([
      expect.objectContaining({ name: PLUGIN_NAME, source: `./${PLUGIN_NAME}` }),
    ])
  })

  it('plugin manifest declares the stdio MCP server via CLAUDE_PLUGIN_ROOT', () => {
    const p = pluginManifest('1.2.3')
    expect(p.name).toBe(PLUGIN_NAME)
    expect(p.version).toBe('1.2.3')
    expect(p.mcpServers).toEqual({
      porcelain: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.js'] },
    })
  })

  it('install commands add the local marketplace then install the plugin', () => {
    const [add, install] = installCommands()
    expect(add).toBe(`claude plugin marketplace add ${pluginMarketplaceDir()}`)
    expect(install).toBe(`claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`)
  })

  it('the bundled skill teaches the agent the tools and the shipped/context tagging', () => {
    expect(REVIEW_SKILL).toContain('set_feature_review')
    expect(REVIEW_SKILL).toContain('"shipped"')
    expect(REVIEW_SKILL).toContain('"context"')
    expect(REVIEW_SKILL).toMatch(/^---\nname: review-with-porcelain/)
  })
})

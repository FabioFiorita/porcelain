// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type McpConfig = {
  mcpServers: {
    Porcelain: {
      command: string
      args: string[]
      cwd: string
    }
  }
}

type PluginManifest = {
  name: string
  version: string
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../../plugins/porcelain/${relativePath}`, import.meta.url), 'utf8'),
  ) as T
}

describe('Claude plugin package', () => {
  it('resolves its bundled MCP connector from Claude’s installed plugin root', () => {
    const config = readJson<McpConfig>('.mcp.json')

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Claude expands this plugin variable.
    const pluginRoot = '${CLAUDE_PLUGIN_ROOT}'
    expect(config.mcpServers.Porcelain).toEqual({
      command: 'node',
      args: [`${pluginRoot}/bin/porcelain-mcp.mjs`],
      cwd: pluginRoot,
    })
  })

  it('ships the same independently versioned bundle to Claude and Codex', () => {
    const claude = readJson<PluginManifest>('.claude-plugin/plugin.json')
    const codex = readJson<PluginManifest>('.codex-plugin/plugin.json')

    expect(claude.name).toBe('porcelain')
    expect(codex.name).toBe('porcelain')
    expect(claude.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(claude.version).toBe(codex.version)
  })
})

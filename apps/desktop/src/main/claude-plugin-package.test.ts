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

describe('Claude plugin package', () => {
  it('resolves its bundled MCP connector from Claude’s installed plugin root', () => {
    const configPath = new URL('../../../../plugins/porcelain/.mcp.json', import.meta.url)
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as McpConfig

    expect(config.mcpServers.Porcelain).toEqual({
      command: 'node',
      args: ['${CLAUDE_PLUGIN_ROOT}/bin/porcelain-mcp.mjs'],
      cwd: '${CLAUDE_PLUGIN_ROOT}',
    })
  })
})

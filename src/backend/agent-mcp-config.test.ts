import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isAgentMcpConfigured,
  PORCELAIN_MCP_KEY,
  writeClaudeMcp,
  writeCodexMcp,
  writeGrokMcp,
  writeOpenCodeMcp,
} from './agent-mcp-config'

describe('agent mcp config writers', () => {
  let tmp: string

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'porcelain-mcp-'))
  })

  afterEach(async () => {
    // Vitest removes the temp dir automatically on process exit; explicit cleanup
    // is skipped to avoid race conditions with parallel tests.
  })

  it('writes Claude Code ~/.claude.json with a stdio MCP server', async () => {
    const path = join(tmp, '.claude.json')
    await writeClaudeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    const config = JSON.parse(content)
    expect(config.mcpServers[PORCELAIN_MCP_KEY]).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['/Users/test/.porcelain/mcp/server.js'],
      env: {},
    })
  })

  it('merges Claude config without clobbering other servers', async () => {
    const path = join(tmp, '.claude.json')
    await writeFile(path, JSON.stringify({ mcpServers: { other: { command: 'foo' } } }, null, 2))
    await writeClaudeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const config = JSON.parse(await readFile(path, 'utf8'))
    expect(config.mcpServers.other).toEqual({ command: 'foo' })
    expect(config.mcpServers[PORCELAIN_MCP_KEY]).toBeDefined()
  })

  it('writes Codex ~/.codex/config.toml with an mcp_servers table', async () => {
    const path = join(tmp, 'config.toml')
    await writeCodexMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    expect(content).toContain('[mcp_servers.porcelain]')
    expect(content).toContain('command = "node"')
    expect(content).toContain('args = [ "/Users/test/.porcelain/mcp/server.js" ]')
  })

  it('merges Codex config without clobbering other mcp_servers', async () => {
    const path = join(tmp, 'config.toml')
    await writeFile(path, '[mcp_servers.other]\ncommand = "foo"\n')
    await writeCodexMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    expect(content).toContain('[mcp_servers.other]')
    expect(content).toContain('[mcp_servers.porcelain]')
  })

  it('writes OpenCode config with a local MCP entry', async () => {
    const path = join(tmp, 'opencode.json')
    await writeOpenCodeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const config = JSON.parse(await readFile(path, 'utf8'))
    expect(config.mcp[PORCELAIN_MCP_KEY]).toEqual({
      type: 'local',
      command: ['node', '/Users/test/.porcelain/mcp/server.js'],
      enabled: true,
    })
  })

  it('merges OpenCode config without clobbering other MCP servers', async () => {
    const path = join(tmp, 'opencode.json')
    await writeFile(path, JSON.stringify({ mcp: { other: { type: 'remote' } } }, null, 2))
    await writeOpenCodeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const config = JSON.parse(await readFile(path, 'utf8'))
    expect(config.mcp.other).toEqual({ type: 'remote' })
    expect(config.mcp[PORCELAIN_MCP_KEY]).toBeDefined()
  })

  it('creates the parent directory when it does not exist yet', async () => {
    // A fresh machine may not have ~/.codex before Codex has ever run.
    const path = join(tmp, 'codex', 'config.toml')
    await writeCodexMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    expect(content).toContain('[mcp_servers.porcelain]')
  })

  it('preserves the existing file mode instead of loosening it', async () => {
    // ~/.claude.json is commonly 0600 (it holds auth) — a rewrite must not widen it.
    const path = join(tmp, '.claude.json')
    await writeFile(path, JSON.stringify({ mcpServers: {} }, null, 2), { mode: 0o600 })
    await writeClaudeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const mode = (await stat(path)).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it('leaves no temp file behind after an atomic write', async () => {
    const path = join(tmp, '.claude.json')
    await writeClaudeMcp(path, '/Users/test/.porcelain/mcp/server.js')
    await expect(readFile(`${path}.porcelain-tmp`, 'utf8')).rejects.toThrow()
  })

  it('writes Grok ~/.grok/config.toml with mcp_servers.porcelain', async () => {
    const path = join(tmp, 'config.toml')
    await writeGrokMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    expect(content).toContain('[mcp_servers.porcelain]')
    expect(content).toContain('command = "node"')
    expect(content).toContain('args = [ "/Users/test/.porcelain/mcp/server.js" ]')
    expect(content).toContain('enabled = true')
  })

  it('merges Grok config without clobbering other mcp_servers', async () => {
    const path = join(tmp, 'config.toml')
    await writeFile(path, '[mcp_servers.other]\ncommand = "foo"\n')
    await writeGrokMcp(path, '/Users/test/.porcelain/mcp/server.js')
    const content = await readFile(path, 'utf8')
    expect(content).toContain('[mcp_servers.other]')
    expect(content).toContain('[mcp_servers.porcelain]')
  })

  it('probes configured status from disk for each agent', async () => {
    const claude = join(tmp, '.claude.json')
    const codex = join(tmp, 'codex.toml')
    const opencode = join(tmp, 'opencode.json')
    const grok = join(tmp, 'grok.toml')
    const missing = join(tmp, 'missing.json')

    expect(await isAgentMcpConfigured('claude', missing)).toBe(false)
    expect(await isAgentMcpConfigured('claude', claude)).toBe(false)

    await writeClaudeMcp(claude, '/s.js')
    await writeCodexMcp(codex, '/s.js')
    await writeOpenCodeMcp(opencode, '/s.js')
    await writeGrokMcp(grok, '/s.js')

    expect(await isAgentMcpConfigured('claude', claude)).toBe(true)
    expect(await isAgentMcpConfigured('codex', codex)).toBe(true)
    expect(await isAgentMcpConfigured('opencode', opencode)).toBe(true)
    expect(await isAgentMcpConfigured('grok', grok)).toBe(true)
  })

  it('treats a config without porcelain as not configured', async () => {
    const path = join(tmp, '.claude.json')
    await writeFile(path, JSON.stringify({ mcpServers: { other: { command: 'x' } } }))
    expect(await isAgentMcpConfigured('claude', path)).toBe(false)
  })
})

import { copyFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { AGENT_NAMES, type AgentMcpResult, type AgentName, writeAgentMcp } from './agent-mcp-config'

export { AGENT_NAMES, type AgentMcpResult, type AgentName }

/** Directory where the bundled MCP server is copied so agents can run it. */
export function mcpServerDir(): string {
  return join(homedir(), '.porcelain', 'mcp')
}

/** Path to the MCP server binary that agents invoke. */
export function installedServerPath(): string {
  return join(mcpServerDir(), 'server.js')
}

// The built, dependency-free stdio server (electron.vite emits it as a second main
// input). Readable even inside app.asar; we copy its bytes into the user's home so
// it becomes a real, runnable file outside the packaged app.
export function builtServerPath(): string {
  return join(app.getAppPath(), 'out', 'main', 'mcp', 'server.js')
}

/** Copy the bundled server to ~/.porcelain/mcp/server.js. Idempotent. */
export async function ensureMcpServer(): Promise<string> {
  const dir = mcpServerDir()
  await mkdir(dir, { recursive: true })
  const serverPath = installedServerPath()
  await copyFile(builtServerPath(), serverPath)
  return serverPath
}

/** Config file path for each agent. */
export function agentConfigPath(agent: AgentName): string {
  switch (agent) {
    case 'claude':
      return join(homedir(), '.claude.json')
    case 'codex':
      return join(homedir(), '.codex', 'config.toml')
    case 'opencode':
      return join(homedir(), '.config', 'opencode', 'opencode.json')
  }
}

/**
 * Write the Porcelain MCP config for the requested agents.
 * Always copies the server first, then writes each agent's config file.
 * Returns per-agent results so the UI can show what succeeded/failed.
 */
export async function installMcpForAgents(agents: AgentName[]): Promise<AgentMcpResult[]> {
  const serverPath = await ensureMcpServer()
  const results: AgentMcpResult[] = []
  for (const agent of agents) {
    try {
      await writeAgentMcp(agent, agentConfigPath(agent), serverPath)
      results.push({ agent, ok: true, output: `Configured ${agent}` })
    } catch (error) {
      results.push({
        agent,
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

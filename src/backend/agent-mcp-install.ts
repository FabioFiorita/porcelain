import { copyFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  AGENT_NAMES,
  type AgentMcpResult,
  type AgentName,
  isAgentMcpConfigured,
  writeAgentMcp,
} from './agent-mcp-config'

/**
 * Daemon-host MCP install: copy the bundled stdio server into `~/.porcelain/mcp/`
 * and write each agent's user-global config so Claude/Codex/OpenCode/Grok on THIS
 * machine can call the review/board/action/note/layer/artifact/evidence tools.
 *
 * This is the remote-aware path — when the Mac app is pointed at a Beelink (or
 * any remote daemon), Settings → Agents → Add MCP must configure the *daemon
 * host*, not the Mac. The server *binary* is also re-copied on every daemon boot
 * (`ensureMcpServer` from `server.ts`) so a daemon upgrade ships new tools without
 * re-running Add MCP — same contract as the Mac shell boot path
 * (`src/main/agent-mcp.ts` / `src/main/index.ts`). Add MCP still writes agent
 * configs the first time; boot only refreshes the shared `server.js`.
 *
 * Layout: the daemon bundle lives at `out/main/daemon/server.js` (and the same
 * relative layout in dist-daemon); the MCP server is the sibling
 * `out/main/mcp/server.js`. Resolved from `__dirname` so cwd never matters.
 */

/** Directory where the bundled MCP server is copied so agents can run it. */
export function mcpServerDir(): string {
  return join(homedir(), '.porcelain', 'mcp')
}

/** Path to the MCP server binary that agents invoke. */
export function installedServerPath(): string {
  return join(mcpServerDir(), 'server.js')
}

/** Config file path for each agent on the daemon host. */
export function agentConfigPath(agent: AgentName): string {
  switch (agent) {
    case 'claude':
      return join(homedir(), '.claude.json')
    case 'codex':
      return join(homedir(), '.codex', 'config.toml')
    case 'opencode':
      return join(homedir(), '.config', 'opencode', 'opencode.json')
    case 'grok':
      return join(homedir(), '.grok', 'config.toml')
  }
}

/** Bundled dependency-free stdio server path (next to the daemon chunk). */
export function builtMcpServerPath(): string {
  return resolve(__dirname, '..', 'mcp', 'server.js')
}

/** Copy the bundled server to ~/.porcelain/mcp/server.js. Idempotent. */
export async function ensureMcpServer(): Promise<string> {
  const dir = mcpServerDir()
  await mkdir(dir, { recursive: true })
  const serverPath = installedServerPath()
  await copyFile(builtMcpServerPath(), serverPath)
  return serverPath
}

/**
 * Write the Porcelain MCP config for the requested agents on the daemon host.
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

/** Probe each agent's config on this host for a Porcelain MCP entry. */
export async function listAgentMcpInfo(): Promise<
  { name: AgentName; configPath: string; configured: boolean }[]
> {
  return Promise.all(
    AGENT_NAMES.map(async (name) => {
      const configPath = agentConfigPath(name)
      return {
        name,
        configPath,
        configured: await isAgentMcpConfigured(name, configPath),
      }
    }),
  )
}

export { AGENT_NAMES, type AgentMcpResult, type AgentName }

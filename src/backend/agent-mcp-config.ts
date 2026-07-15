import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml'

export type AgentName = 'claude' | 'codex' | 'opencode'

export interface AgentMcpResult {
  agent: AgentName
  ok: boolean
  output: string
}

export const AGENT_NAMES: AgentName[] = ['claude', 'codex', 'opencode']

export const PORCELAIN_MCP_KEY = 'porcelain'

interface ClaudeConfig {
  mcpServers?: Record<
    string,
    { type: string; command: string; args: string[]; env?: Record<string, string> }
  >
}

interface CodexConfig {
  mcp_servers?: Record<string, { command: string; args: string[] }>
}

interface OpenCodeConfig {
  mcp?: Record<string, { type: string; command: string[]; enabled: boolean }>
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

// Atomic write: materialize into a sibling temp file, then rename over the
// target. These files are the user's live agent state — `~/.claude.json` holds
// Claude Code's projects/history/auth — so a plain truncate-and-write risks a
// half-written config on a crash or a race with the agent writing concurrently;
// rename is atomic on POSIX. We also create the parent dir (a fresh machine may
// not have `~/.codex` / `~/.config/opencode` yet) and preserve the existing
// file's mode (`.claude.json` is commonly 0600 — don't loosen it to 0644).
async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  let mode: number | undefined
  try {
    mode = (await stat(path)).mode & 0o777
  } catch (error) {
    if (!(isErrnoException(error) && error.code === 'ENOENT')) throw error
  }
  const tmp = `${path}.porcelain-tmp`
  await writeFile(tmp, content)
  if (mode !== undefined) await chmod(tmp, mode)
  await rename(tmp, path)
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const content = await readFile(path, 'utf8')
    return JSON.parse(content) as T
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function readTomlFile<T>(path: string): Promise<T | undefined> {
  try {
    const content = await readFile(path, 'utf8')
    return parseToml(content) as T
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function writeTomlFile(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, stringifyToml(value as Parameters<typeof stringifyToml>[0]))
}

export async function writeClaudeMcp(configPath: string, serverPath: string): Promise<void> {
  const config = (await readJsonFile<ClaudeConfig>(configPath)) ?? {}
  const mcpServers = config.mcpServers ?? {}
  mcpServers[PORCELAIN_MCP_KEY] = { type: 'stdio', command: 'node', args: [serverPath], env: {} }
  config.mcpServers = mcpServers
  await writeJsonFile(configPath, config)
}

export async function writeCodexMcp(configPath: string, serverPath: string): Promise<void> {
  const config = (await readTomlFile<CodexConfig>(configPath)) ?? {}
  const mcpServers = config.mcp_servers ?? {}
  mcpServers[PORCELAIN_MCP_KEY] = { command: 'node', args: [serverPath] }
  config.mcp_servers = mcpServers
  await writeTomlFile(configPath, config)
}

export async function writeOpenCodeMcp(configPath: string, serverPath: string): Promise<void> {
  const config = (await readJsonFile<OpenCodeConfig>(configPath)) ?? {}
  const mcp = config.mcp ?? {}
  mcp[PORCELAIN_MCP_KEY] = { type: 'local', command: ['node', serverPath], enabled: true }
  config.mcp = mcp
  await writeJsonFile(configPath, config)
}

export async function writeAgentMcp(
  agent: AgentName,
  configPath: string,
  serverPath: string,
): Promise<void> {
  switch (agent) {
    case 'claude':
      return writeClaudeMcp(configPath, serverPath)
    case 'codex':
      return writeCodexMcp(configPath, serverPath)
    case 'opencode':
      return writeOpenCodeMcp(configPath, serverPath)
  }
}

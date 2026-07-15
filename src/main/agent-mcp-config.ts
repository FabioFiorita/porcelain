// Re-export pure MCP config writers from the daemon package so the shell and the
// daemon share one implementation (remote "Install MCP" must run on the daemon host).
export {
  AGENT_NAMES,
  type AgentMcpResult,
  type AgentName,
  PORCELAIN_MCP_KEY,
  writeAgentMcp,
  writeClaudeMcp,
  writeCodexMcp,
  writeOpenCodeMcp,
} from '../backend/agent-mcp-config'

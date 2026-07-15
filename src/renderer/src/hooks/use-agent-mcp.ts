import type { AgentMcpResult, AgentName } from '@backend/agent-mcp-config'
import { trpc } from '@renderer/lib/trpc'

/**
 * MCP install targets the *active daemon host* (not the Mac shell). Local daemon →
 * local agents; remote daemon → Beelink agents. Channel files and agent CLIs live
 * on the daemon host, so configuring the shell Mac while pointed at a remote
 * environment was the bug this fixes.
 */
export function useAgentMcpInfo():
  | { agents: { name: AgentName; configPath: string }[] }
  | undefined {
  const { data } = trpc.agentMcpInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
  })
  return data
}

export function useInstallAgentMcp(): {
  install: (agents?: AgentName[]) => void
  isInstalling: boolean
  result: AgentMcpResult[] | undefined
  error: string | null
} {
  const mutation = trpc.installAgentMcp.useMutation()
  return {
    install: (agents) => mutation.mutate(agents),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}

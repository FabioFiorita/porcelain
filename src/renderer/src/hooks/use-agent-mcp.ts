import type { AgentMcpResult, AgentName } from '@backend/agent-mcp-config'
import { trpc } from '@renderer/lib/trpc'

/**
 * MCP install targets the *active daemon host* (not the Mac shell). Local daemon →
 * local agents; remote daemon → Beelink agents. Channel files and agent CLIs live
 * on the daemon host, so configuring the shell Mac while pointed at a remote
 * environment was the bug this fixes.
 *
 * `configured` is probed from each agent's config file on disk — never a
 * client-local preference (that caused false "not configured" when MCP was
 * written outside the app or prefs were cleared).
 */
export function useAgentMcpInfo():
  | { agents: { name: AgentName; configPath: string; configured: boolean }[] }
  | undefined {
  const { data } = trpc.agentMcpInfo.useQuery(undefined, {
    staleTime: 30_000,
  })
  return data
}

export function useInstallAgentMcp(): {
  install: (agents?: AgentName[]) => void
  isInstalling: boolean
  result: AgentMcpResult[] | undefined
  error: string | null
} {
  const utils = trpc.useUtils()
  const mutation = trpc.installAgentMcp.useMutation({
    onSuccess: async () => {
      await utils.agentMcpInfo.invalidate()
    },
  })
  return {
    install: (agents) => mutation.mutate(agents),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}

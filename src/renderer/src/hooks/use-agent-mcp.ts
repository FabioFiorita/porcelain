import type { AgentMcpResult, AgentName } from '@main/agent-mcp'
import { isBrowser } from '@renderer/lib/platform'
import { shellTrpc } from '@renderer/lib/trpc'

export function useAgentMcpInfo():
  | { agents: { name: AgentName; configPath: string }[] }
  | undefined {
  // Shell-only — the browser client hides the Agents section, so this is never queried there.
  const { data } = shellTrpc.agentMcpInfo.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isBrowser,
  })
  return data
}

export function useInstallAgentMcp(): {
  install: (agents?: AgentName[]) => void
  isInstalling: boolean
  result: AgentMcpResult[] | undefined
  error: string | null
} {
  const mutation = shellTrpc.installAgentMcp.useMutation()
  return {
    install: (agents) => mutation.mutate(agents),
    isInstalling: mutation.isPending,
    result: mutation.data,
    error: mutation.error?.message ?? null,
  }
}

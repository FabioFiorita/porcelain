import { Button } from '@renderer/components/ui/button'
import { useAgentMcpInfo, useInstallAgentMcp } from '@renderer/hooks/use-agent-mcp'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { Check, CircleCheck, Loader2, TriangleAlert, XCircle } from 'lucide-react'
import { useEffect } from 'react'

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
}

export function AgentMcpSection(): React.JSX.Element {
  const info = useAgentMcpInfo()
  const { install, isInstalling, result, error } = useInstallAgentMcp()
  const mcpClaudeConfigured = usePreferencesStore((s) => s.mcpClaudeConfigured)
  const mcpCodexConfigured = usePreferencesStore((s) => s.mcpCodexConfigured)
  const mcpOpenCodeConfigured = usePreferencesStore((s) => s.mcpOpenCodeConfigured)
  const setMcpConfigured = usePreferencesStore((s) => s.setMcpConfigured)

  const configured: Record<string, boolean> = {
    claude: mcpClaudeConfigured,
    codex: mcpCodexConfigured,
    opencode: mcpOpenCodeConfigured,
  }

  useEffect(() => {
    if (!result) return
    for (const item of result) {
      setMcpConfigured(item.agent, item.ok)
    }
  }, [result, setMcpConfigured])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <h4 className="text-sm-minus font-semibold">Add MCP</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Writes the Porcelain MCP server into each agent's config so it can call the review, board,
          action, note, layer, and artifact tools. Add only the agents you use.
        </p>
      </div>

      {info?.agents && (
        <ul className="flex min-w-0 flex-col gap-3">
          {info.agents.map((agent) => {
            const isConfigured = configured[agent.name]
            return (
              <li
                key={agent.name}
                className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-card p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-sm-minus">
                    {isConfigured ? (
                      <CircleCheck className="size-3.5 text-success" />
                    ) : (
                      <XCircle className="size-3.5 text-muted-foreground/60" />
                    )}
                    <span className={isConfigured ? 'text-foreground' : ''}>
                      {AGENT_LABELS[agent.name] ?? agent.name}
                    </span>
                  </div>
                  <code className="truncate font-mono text-xs-minus text-muted-foreground/70">
                    {agent.configPath}
                  </code>
                </div>
                <Button
                  size="sm"
                  variant={isConfigured ? 'outline' : 'default'}
                  onClick={() => install([agent.name])}
                  disabled={isInstalling}
                >
                  {isInstalling && <Loader2 className="animate-spin" />}
                  {isConfigured ? 'Re-add' : 'Add MCP'}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {result && (
        <div className="flex min-w-0 flex-col gap-2">
          {result.map((item) => (
            <p
              key={item.agent}
              className={`flex items-start gap-1.5 text-xs ${item.ok ? 'text-success' : 'text-warning'}`}
            >
              {item.ok ? (
                <Check className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              )}
              {AGENT_LABELS[item.agent] ?? item.agent}: {item.output}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

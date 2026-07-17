import { Button } from '@renderer/components/ui/button'
import { useAgentMcpInfo, useInstallAgentMcp } from '@renderer/hooks/use-agent-mcp'
import { compactButtonClass } from '@renderer/lib/controls'
import { Check, CircleCheck, Loader2, TriangleAlert, XCircle } from 'lucide-react'

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
  grok: 'Grok',
}

/**
 * Agent rows only — the parent Agents "MCP" group owns the section title/blurb
 * so we don't stack another same-weight heading under it.
 */
export function AgentMcpSection(): React.JSX.Element {
  const info = useAgentMcpInfo()
  const { install, isInstalling, result, error } = useInstallAgentMcp()

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {info?.agents && (
        <ul className="min-w-0 divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          {info.agents.map((agent) => {
            const isConfigured = agent.configured
            return (
              <li key={agent.name} className="flex min-w-0 items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    {isConfigured ? (
                      <CircleCheck className="size-3.5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="size-3.5 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className="text-sm-minus font-medium">
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
                  className={compactButtonClass}
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

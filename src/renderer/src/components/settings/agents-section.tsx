import { Separator } from '@renderer/components/ui/separator'
import { AgentMcpSection } from './agent-mcp-section'
import { SkillsSection } from './skills-section'

export function AgentsSection(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">Skills</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Porcelain's companion skills teach your agent how to push feature reviews, read
            comments, manage the board, curate actions, and author artifacts. They ship through{' '}
            <span className="font-medium">skills.sh</span> and update independently of the MCP
            server.
          </p>
        </div>
        <SkillsSection />
      </section>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">MCP</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The Porcelain MCP server gives your agent the actual tools — set_feature_review,
            list_cards, create_action, and the rest. One button writes the config for Claude Code,
            Codex, and OpenCode.
          </p>
        </div>
        <AgentMcpSection />
      </section>
    </div>
  )
}

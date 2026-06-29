import { Separator } from '@renderer/components/ui/separator'
import { CodexSection } from './codex-section'
import { PluginSection } from './plugin-section'

export function AgentsSection(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">Claude Code</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Installs a plugin that bundles the Porcelain{' '}
            <span className="font-medium">MCP server</span> and its{' '}
            <span className="font-medium">skills</span> — review, project board, and saved actions —
            so your agent can push the whole feature into review, read your comments, and stay in
            sync with the board.
          </p>
        </div>
        <PluginSection target="claude" />
      </section>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">Cursor</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Installs the same Porcelain <span className="font-medium">MCP server</span> and{' '}
            <span className="font-medium">skills</span> as a local Cursor plugin — push feature
            review sets, read your comments and notes, manage the board, and tune flow layers from
            Cursor&apos;s agent.
          </p>
        </div>
        <PluginSection target="cursor" />
      </section>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">Codex</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Installs a Codex plugin marketplace with the same Porcelain{' '}
            <span className="font-medium">MCP server</span> and{' '}
            <span className="font-medium">skills</span>, so Codex can push feature reviews, read
            comments and notes, update the board, and curate saved actions.
          </p>
        </div>
        <CodexSection />
      </section>
    </div>
  )
}

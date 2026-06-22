import { Separator } from '@renderer/components/ui/separator'
import { PluginSection } from './plugin-section'

// Reorganize-only for now: Claude Code is the one working integration (the plugin
// that bundles the MCP server + skills); Codex/Cursor are declared but not built
// yet, so they render as labeled placeholders rather than dead controls.
const PLANNED = [
  {
    name: 'Codex',
    blurb: 'Push feature review sets from the OpenAI Codex CLI. Planned.',
  },
  {
    name: 'Cursor',
    blurb: 'Feed the feature view from Cursor’s agent. Planned.',
  },
]

export function AgentsSection(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm-minus font-semibold">Claude Code</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Installs a plugin that bundles the Porcelain{' '}
            <span className="font-medium">MCP server</span> and its{' '}
            <span className="font-medium">skills</span> — review, project board, and saved actions —
            so your agent can push the whole feature into review, read your comments, and stay in
            sync with the board.
          </p>
        </div>
        <PluginSection />
      </section>

      <Separator />

      {PLANNED.map((agent) => (
        <section key={agent.name} className="flex flex-col gap-1 opacity-60">
          <div className="flex items-center gap-2">
            <h3 className="text-sm-minus font-semibold">{agent.name}</h3>
            <span className="rounded-full border px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{agent.blurb}</p>
        </section>
      ))}
    </div>
  )
}

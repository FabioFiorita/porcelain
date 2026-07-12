import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Separator } from '@renderer/components/ui/separator'
import { useAgentProviders } from '@renderer/hooks/use-agents'
import type { AgentProvider, ProviderStatus } from '@shared/agent-protocol'
import { AgentMcpSection } from './agent-mcp-section'
import { SkillsSection } from './skills-section'

const PROVIDER_LABEL: Record<AgentProvider, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
}

/** The install/auth line for a provider — the second, dim row under its name. */
function statusLabel(provider: ProviderStatus): string {
  if (!provider.installed) return 'Not installed'
  if (!provider.authenticated) return 'Installed, not signed in'
  return provider.account ? `Signed in as ${provider.account}` : 'Signed in'
}

/** Per-provider install/auth state, probed from the CLIs on the daemon's host. */
function ProvidersBlock(): React.JSX.Element {
  const providers = useAgentProviders()
  if (providers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Detecting agent CLIs (Claude Code, Codex, OpenCode)…
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {providers.map((provider) => {
        const ready = provider.installed && provider.authenticated
        return (
          <div
            key={provider.provider}
            className="glaze-tile flex items-center gap-2.5 p-2 [--tile-fill:var(--surface-2)]"
          >
            <ProviderGlyph provider={provider.provider} className="size-4 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-medium text-foreground">
                {PROVIDER_LABEL[provider.provider]}
              </span>
              <span className="truncate text-2xs text-muted-foreground">
                {statusLabel(provider)}
              </span>
            </span>
            <span
              className="size-1.5 shrink-0 rounded-full data-[ready=false]:bg-muted-foreground/40 data-[ready=true]:bg-diff-add-emphasis"
              data-ready={ready}
              aria-hidden
            />
          </div>
        )
      })}
    </div>
  )
}

export function AgentsSection(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h3 className="text-sm-minus font-semibold">Providers</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The coding-agent CLIs Porcelain can run threads on — whether each is installed and
            signed in on the daemon's machine.
          </p>
        </div>
        <ProvidersBlock />
      </section>

      <Separator />

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

import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { useAgentProviders, useRefreshAgentProviders } from '@renderer/hooks/use-agents'
import { copyText } from '@renderer/lib/utils'
import type { AgentProvider, ProviderStatus } from '@shared/agent-protocol'
import { PROVIDER_LABEL } from '@shared/agent-protocol'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { AgentMcpSection } from './agent-mcp-section'
import { SkillsSection } from './skills-section'

// Per-provider setup facts the app can't otherwise surface: the install command, the
// sign-in command, and the binary-path env override each driver honors. Used to turn a
// not-installed / not-signed-in row into an actionable one-liner.
const PROVIDER_SETUP: Record<AgentProvider, { install: string; signIn: string; bin: string }> = {
  claude: {
    install: 'npm i -g @anthropic-ai/claude-code',
    signIn: 'claude',
    bin: 'PORCELAIN_CLAUDE_BIN',
  },
  codex: { install: 'npm i -g @openai/codex', signIn: 'codex login', bin: 'PORCELAIN_CODEX_BIN' },
  opencode: {
    install: 'npm i -g opencode-ai',
    signIn: 'opencode auth login',
    bin: 'PORCELAIN_OPENCODE_BIN',
  },
}

/** The install/auth line for a provider — the second, dim row under its name. */
function statusLabel(provider: ProviderStatus): string {
  if (!provider.installed) return 'Not installed'
  if (!provider.authenticated) return 'Installed, not signed in'
  return provider.account ? `Signed in as ${provider.account}` : 'Signed in'
}

/** A monospace token that copies its own text on click (via copyText for the insecure-context
 *  browser client), briefly confirming. */
function CopyableCode({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${text}`}
      onClick={async () => {
        await copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="rounded bg-muted/60 px-1 py-0.5 font-mono text-2xs text-foreground transition-colors hover:bg-muted"
    >
      {copied ? 'Copied' : text}
    </button>
  )
}

/** The actionable hint under a not-ready provider: how to install (plus the binary override) or
 *  how to sign in. Ready providers get none. */
function ProviderHint({ provider }: { provider: ProviderStatus }): React.JSX.Element | null {
  const setup = PROVIDER_SETUP[provider.provider]
  if (!provider.installed) {
    return (
      <span className="flex flex-wrap items-center gap-1 text-2xs text-muted-foreground">
        Install <CopyableCode text={setup.install} /> — or point at a binary with{' '}
        <CopyableCode text={setup.bin} />
      </span>
    )
  }
  if (!provider.authenticated) {
    return (
      <span className="flex flex-wrap items-center gap-1 text-2xs text-muted-foreground">
        Sign in <CopyableCode text={setup.signIn} />
      </span>
    )
  }
  return null
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
            className="glaze-tile flex flex-col gap-1.5 p-2 [--tile-fill:var(--surface-2)]"
          >
            <div className="flex items-center gap-2.5">
              <ProviderGlyph
                provider={provider.provider}
                className="size-4 text-muted-foreground"
              />
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
            <ProviderHint provider={provider} />
          </div>
        )
      })}
    </div>
  )
}

export function AgentsSection(): React.JSX.Element {
  const { refresh, isPending } = useRefreshAgentProviders()
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm-minus font-semibold">Providers</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The coding-agent CLIs Porcelain can run threads on — whether each is installed and
              signed in on the daemon's machine.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh providers"
            disabled={isPending}
            onClick={refresh}
          >
            <RefreshCw className={isPending ? 'animate-spin' : undefined} />
          </Button>
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

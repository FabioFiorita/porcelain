import type { LimitsRefresh } from '@backend/repo-config'
import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Separator } from '@renderer/components/ui/separator'
import {
  useAgentProviders,
  useLimitsRefresh,
  useRefreshAgentProviders,
  useSetLimitsRefresh,
} from '@renderer/hooks/use-agents'
import { compactButtonClass } from '@renderer/lib/controls'
import { cn, copyText } from '@renderer/lib/utils'
import type { AgentProvider, ProviderStatus } from '@shared/agent-protocol'
import { PROVIDER_LABEL } from '@shared/agent-protocol'
import { ChevronDown, RefreshCw } from 'lucide-react'
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
  grok: {
    install: 'curl -fsSL https://grok.com/install | sh',
    signIn: 'grok login',
    bin: 'PORCELAIN_GROK_BIN',
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
      className="rounded bg-muted/60 px-1 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
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
        Detecting agent CLIs (Claude Code, Codex, OpenCode, Grok)…
      </p>
    )
  }
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
      {providers.map((provider) => {
        const ready = provider.installed && provider.authenticated
        return (
          <div key={provider.provider} className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center gap-2.5">
              <ProviderGlyph
                provider={provider.provider}
                className="size-4 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm-minus font-medium text-foreground">
                  {PROVIDER_LABEL[provider.provider]}
                </span>
                <span className="truncate text-xs text-muted-foreground">
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

// The user-facing label for each limits-refresh choice — one map shared by the
// dropdown's trigger (the current choice) and its menu items.
const LIMITS_REFRESH_LABEL: Record<LimitsRefresh, string> = {
  '1m': 'Every minute',
  '5m': 'Every 5 minutes',
  '15m': 'Every 15 minutes',
  manual: 'Manually',
}

/** The Limits-group poll cadence — a control under Providers, not a peer section title. */
function LimitsRefreshRow(): React.JSX.Element {
  const value = useLimitsRefresh()
  const { set } = useSetLimitsRefresh()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm-minus font-medium">Limits refresh</p>
        <p className="text-xs text-muted-foreground">
          How often the Agent panel re-checks provider usage limits. Some providers read them by
          running a CLI, so a slower cadence spawns fewer processes.
        </p>
        <p className="text-xs text-muted-foreground">
          Claude limits are read through CodexBar when it's installed.{' '}
          <a
            href="https://github.com/steipete/CodexBar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Get CodexBar
          </a>
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(compactButtonClass, 'shrink-0 gap-1')}
            >
              {LIMITS_REFRESH_LABEL[value]}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(choice) => {
              if (choice === '1m' || choice === '5m' || choice === '15m' || choice === 'manual') {
                set(choice satisfies LimitsRefresh)
              }
            }}
          >
            {(Object.keys(LIMITS_REFRESH_LABEL) as LimitsRefresh[]).map((choice) => (
              <DropdownMenuRadioItem key={choice} value={choice} className="whitespace-nowrap">
                {LIMITS_REFRESH_LABEL[choice]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Group section title — one step above control labels (see General PreferenceRow). */
function SectionHeading({
  title,
  blurb,
  action,
}: {
  title: string
  blurb: string
  action?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {action}
    </div>
  )
}

export function AgentsSection(): React.JSX.Element {
  const { refresh, isPending } = useRefreshAgentProviders()
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeading
          title="Providers"
          blurb="The coding-agent CLIs Porcelain can run threads on — whether each is installed and signed in on the daemon's machine."
          action={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh providers"
              disabled={isPending}
              onClick={refresh}
            >
              <RefreshCw className={isPending ? 'animate-spin' : undefined} />
            </Button>
          }
        />
        <ProvidersBlock />
        <LimitsRefreshRow />
      </section>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeading
          title="Skills"
          blurb="Companion skills teach your agent how to push feature reviews, read comments, manage the board, curate actions, and author artifacts. They ship through skills.sh and update independently of the MCP server."
        />
        <SkillsSection />
      </section>

      <Separator />

      <section className="flex min-w-0 flex-col gap-3">
        <SectionHeading
          title="MCP"
          blurb="Writes the Porcelain MCP server into each agent's config on the active daemon host (this Mac, or a remote like the Beelink). Status is read from each config file on disk — add only the agents you use."
        />
        <AgentMcpSection />
      </section>
    </div>
  )
}

import { PlanSteps } from '@renderer/components/agent/plan-steps'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useAgentLimits, useAgentThreads } from '@renderer/hooks/use-agents'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useTabsStore } from '@renderer/stores/tabs'
import type { AgentProvider, TimelineItem } from '@shared/agent-protocol'
import { Loader2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

type PlanTimelineItem = Extract<TimelineItem, { kind: 'plan' }>
type ToolTimelineItem = Extract<TimelineItem, { kind: 'tool' }>

/** Compact token count: 340 → "340", 1200 → "1.2k", 45000 → "45k", 1.5M → "1.5M". */
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n)
  const [div, suffix] = n < 1_000_000 ? [1000, 'k'] : [1_000_000, 'M']
  const v = n / div
  const s = v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '')
  return `${s}${suffix}`
}

/** A notional session cost as a short dollar figure: 0.42 → "$0.42", 12.5 → "$12.50". */
export function formatCostUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

/**
 * A quota window's reset as a relative "resets in Xh Ym" phrase (dropping a zero hour/minute:
 * "resets in 42m", "resets in 3h"). A reset in the past — or under a minute away — reads
 * "resets soon". `now` is injected so the mapping is deterministic to test.
 */
export function formatResetIn(resetsAt: number, now: number): string {
  const ms = resetsAt - now
  if (ms < 60_000) return 'resets soon'
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `resets in ${minutes}m`
  if (minutes === 0) return `resets in ${hours}h`
  return `resets in ${hours}h ${minutes}m`
}

/**
 * The thread this panel narrates: the active viewer tab's thread when an agent tab is
 * focused, otherwise the most recently updated working thread — so the panel follows
 * what you're looking at, and falls back to whatever is busiest.
 */
function useRelevantThreadId(): string | null {
  const threads = useAgentThreads()
  const activeAgentThreadId = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    const tab = pane?.tabs.find((t) => t.id === pane.activeTabId)
    return tab?.kind === 'agent' ? tab.path : null
  })
  if (activeAgentThreadId !== null) return activeAgentThreadId
  const working = threads.filter((t) => t.status === 'working')
  if (working.length === 0) return null
  return working.reduce((latest, t) => (t.updatedAt > latest.updatedAt ? t : latest)).id
}

/** The thread's current plan — steps + an N/M progress line. Hidden when there is none. */
function PlanGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  // Select just the latest plan item: its object identity only changes when the plan
  // itself is re-emitted, so streaming text deltas don't re-render the sidebar.
  const plan = useAgentThreadsStore((s): PlanTimelineItem | undefined => {
    const items = s.threads[threadId]?.items
    if (!items) return undefined
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item.kind === 'plan') return item
    }
    return undefined
  })
  if (!plan || plan.steps.length === 0) return null
  const done = plan.steps.filter((step) => step.status === 'done').length
  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Plan
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1">
        <div className="glaze-tile flex flex-col gap-1.5 p-2.5 [--tile-fill:var(--surface-2)]">
          <PlanSteps steps={plan.steps} />
          <p className="text-2xs text-muted-foreground">
            {done} of {plan.steps.length} done
          </p>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** What the agent is doing right now — every still-running tool call, one compact row each. */
function RunningGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  // Shallow-compared slice of the running tools: tool item objects are only replaced when
  // their own status flips, so text deltas leave the array shallow-equal — no re-render.
  const running = useAgentThreadsStore(
    useShallow((s): ToolTimelineItem[] => {
      const items = s.threads[threadId]?.items ?? []
      return items.filter(
        (item): item is ToolTimelineItem => item.kind === 'tool' && item.status === 'running',
      )
    }),
  )
  if (running.length === 0) return null
  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Running
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
        {running.map((item) => (
          <div
            key={item.id}
            className="glaze-tile flex items-center gap-2 p-2 [--tile-fill:var(--surface-2)]"
          >
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="shrink-0 text-xs font-medium text-foreground">{item.title}</span>
              {item.detail !== undefined && item.detail !== '' && (
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">
                  {item.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * The thread's accumulated token usage — the last turn's I/O plus the running total, one
 * muted line. Read from the daemon-owned roster (`threadInfo.usage`), so it survives
 * reloads. Hidden until the first turn reports usage (a provider that reports none stays
 * hidden forever).
 */
function UsageGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  const usage = useAgentThreads().find((t) => t.id === threadId)?.usage
  if (!usage) return null
  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Usage
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1">
        <p className="text-2xs tabular-nums text-muted-foreground">
          Last turn {formatTokenCount(usage.turnInput)} in · {formatTokenCount(usage.turnOutput)}{' '}
          out — total {formatTokenCount(usage.totalInput)} in ·{' '}
          {formatTokenCount(usage.totalOutput)} out
          {usage.totalCostUsd !== undefined && (
            // "est." because the figure is notional under a subscription plan (token counts ×
            // list prices), not billed spend — see the protocol/audit notes.
            <> · {formatCostUsd(usage.totalCostUsd)} est.</>
          )}
        </p>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * The running provider's quota windows — one row each: label, a thin fill bar, the used
 * percent, and a dim "resets in Xh Ym". Hidden when the provider exposes no limits (returns
 * null: OpenCode, or a non-subscription Claude/Codex account). `now` is read once per render
 * for the relative reset labels.
 */
function LimitsGroup({ provider }: { provider: AgentProvider }): React.JSX.Element | null {
  const limits = useAgentLimits(provider)
  if (!limits || limits.windows.length === 0) return null
  const now = Date.now()
  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Limits
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-2 px-1">
        {limits.windows.map((window) => {
          const percent = Math.max(0, Math.min(100, window.usedPercent))
          return (
            <div key={window.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xs font-medium text-foreground">{window.label}</span>
                <span className="text-2xs tabular-nums text-muted-foreground">
                  {Math.round(percent)}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={window.label}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
              {window.resetsAt !== undefined && (
                <span className="text-2xs text-muted-foreground">
                  {formatResetIn(window.resetsAt, now)}
                </span>
              )}
            </div>
          )
        })}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * The Agent tab's Quick Access: the session at a glance — the relevant thread's plan, its
 * currently-running tool calls, and the last turn's token usage. Each group hides when
 * empty (provider install/auth state lives in Settings → Agents, not here). The relevant
 * thread is the active agent tab's, else the busiest working thread.
 */
export function AgentsQuickAccess(): React.JSX.Element | null {
  const threadId = useRelevantThreadId()
  const provider = useAgentThreads().find((t) => t.id === threadId)?.provider ?? null
  if (threadId === null) return null
  return (
    <>
      <PlanGroup threadId={threadId} />
      <RunningGroup threadId={threadId} />
      <UsageGroup threadId={threadId} />
      {provider !== null && <LimitsGroup provider={provider} />}
    </>
  )
}

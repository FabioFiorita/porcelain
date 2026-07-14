import { PlanSteps } from '@renderer/components/agent/plan-steps'
import { Button } from '@renderer/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useAgentLimits, useAgentThreads, useRefreshAgentLimits } from '@renderer/hooks/use-agents'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { AgentProvider, TimelineItem } from '@shared/agent-protocol'
import { FilePenLine, FileText, Loader2, RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

/** Stable empty timeline so `?? EMPTY_ITEMS` doesn't allocate a new `[]` every snapshot. */
const EMPTY_ITEMS: TimelineItem[] = []

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

/**
 * What the agent is doing right now — every still-running tool call, with the command/path
 * on its own line (not truncated into a single crowded row). The value is the detail, not
 * just "Bash + spinner".
 */
function ActivityGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  // Shallow-compared slice of the running tools: tool item objects are only replaced when
  // their own status flips (or detail lands mid-stream), so text deltas leave the array
  // shallow-equal — no re-render.
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
        Activity
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1.5 px-1">
        {running.map((item) => (
          <div
            key={item.id}
            className="glaze-tile flex flex-col gap-1 p-2.5 [--tile-fill:var(--surface-2)]"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
            </div>
            {item.detail !== undefined && item.detail !== '' && (
              <p className="pl-5 font-mono text-2xs break-all whitespace-pre-wrap text-muted-foreground">
                {item.detail}
              </p>
            )}
          </div>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** Titles whose `detail` is a file path the user can open in the viewer. */
const FILE_TOOL_TITLES = new Set(['Read', 'Edit', 'Write', 'Edit notebook'])

export type TouchedFile = {
  path: string
  /** Last action against this path in timeline order (Write/Edit beat a prior Read). */
  action: 'read' | 'edit' | 'write'
}

/**
 * Deduped file paths the agent has Read/Edit/Written in this thread (timeline order,
 * last action wins). Pure so it's unit-testable without mounting the sidebar.
 */
export function touchedFilesFromItems(items: TimelineItem[]): TouchedFile[] {
  const byPath = new Map<string, TouchedFile>()
  for (const item of items) {
    if (item.kind !== 'tool') continue
    if (!FILE_TOOL_TITLES.has(item.title)) continue
    const path = item.detail?.trim()
    if (path === undefined || path === '') continue
    const action: TouchedFile['action'] =
      item.title === 'Write' ? 'write' : item.title === 'Read' ? 'read' : 'edit'
    // Later ops replace earlier ones so an Edit after a Read lands as "edit".
    byPath.set(path, { path, action })
  }
  return [...byPath.values()]
}

/**
 * Files the agent has touched in this thread — click a row to open it in the viewer.
 * The main timeline collapses tools; this is where you jump into what changed.
 */
function FilesGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  // Select the items array by identity (not a mapped TouchedFile[] — that would allocate
  // new objects every snapshot and trip useShallow into an infinite re-render loop).
  const items = useAgentThreadsStore((s) => s.threads[threadId]?.items ?? EMPTY_ITEMS)
  const files = useMemo(() => touchedFilesFromItems(items), [items])
  const repoPath = useRepoStore((s) => s.repo?.path ?? null)
  const openTab = useTabsStore((s) => s.openTab)
  if (files.length === 0) return null

  const open = (path: string): void => {
    // Claude usually emits absolute paths; relative ones are joined to the open repo.
    const absolute =
      path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
        ? path
        : repoPath !== null
          ? `${repoPath}/${path}`
          : path
    openTab({
      id: tabId('file', absolute),
      kind: 'file',
      title: fileName(absolute),
      path: absolute,
      preview: true,
    })
  }

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Files
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5 px-1">
        {files.map((file) => {
          const name = fileName(file.path)
          const Icon = file.action === 'read' ? FileText : FilePenLine
          return (
            <button
              key={file.path}
              type="button"
              onClick={() => open(file.path)}
              title={file.path}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                'hover:bg-(--hover-fill) focus-visible:bg-(--hover-fill) focus-visible:outline-none',
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  file.action === 'read' ? 'text-muted-foreground' : 'text-foreground',
                )}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{name}</span>
              <span className="shrink-0 text-2xs text-muted-foreground capitalize">
                {file.action}
              </span>
            </button>
          )
        })}
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
  const { refresh, isPending } = useRefreshAgentLimits()
  if (!limits || limits.windows.length === 0) return null
  const now = Date.now()
  return (
    <SidebarGroup className="px-3">
      <div className="flex items-center justify-between gap-1 pr-1">
        <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Limits
        </SidebarGroupLabel>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Refresh limits"
          disabled={isPending}
          onClick={() => refresh(provider)}
        >
          <RefreshCw className={isPending ? 'animate-spin' : undefined} />
        </Button>
      </div>
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
 * The Agent tab's Session companion (right sidebar): plan, live activity with full
 * command/path, files touched (click to open), usage, and rate limits. Each group hides
 * when empty. The relevant thread is the active agent tab's, else the busiest working
 * thread.
 */
export function AgentsQuickAccess(): React.JSX.Element | null {
  const threadId = useRelevantThreadId()
  const provider = useAgentThreads().find((t) => t.id === threadId)?.provider ?? null
  if (threadId === null) return null
  return (
    <>
      <ActivityGroup threadId={threadId} />
      <PlanGroup threadId={threadId} />
      <FilesGroup threadId={threadId} />
      <UsageGroup threadId={threadId} />
      {provider !== null && <LimitsGroup provider={provider} />}
    </>
  )
}

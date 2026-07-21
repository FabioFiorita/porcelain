import { PlanSteps } from '@renderer/components/agent/plan-steps'
import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Button } from '@renderer/components/ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useAgentLimits, useAgentThreads, useRefreshAgentLimits } from '@renderer/hooks/use-agents'
import { useActiveRemoteEnvironment } from '@renderer/hooks/use-remote-daemon'
import { type TouchedFile, touchedFilesFromItems } from '@renderer/lib/agent-touched-files'
import { fileName } from '@renderer/lib/paths'
import { openChanges, openFile } from '@renderer/lib/surface-handoffs'
import { cn } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import type { AgentProvider, TimelineItem } from '@shared/agent-protocol'
import { PROVIDER_LABEL } from '@shared/agent-protocol'
import { TestIds } from '@shared/test-ids'
import { FilePenLine, FileText, GitBranch, Loader2, RefreshCw } from 'lucide-react'
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
 * Human elapsed duration for a running (or finished) turn: 42s / 1m 40s / 1h 2m.
 * Matches Claude Code's "Worked for …" language so the Agent tab reads the same.
 * Pure + `ms`-based so tests don't depend on wall-clock.
 */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours === 0) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

/**
 * Last-turn token line: "48k in (42k cached) · 1.2k out". Cache parenthetical only when
 * the driver reported cache reads (Claude). Cost is NOT here — it lives on the total line
 * / session strip so a cumulative est. isn't misread as last-turn spend.
 */
export function formatUsageLine(usage: {
  turnInput: number
  turnOutput: number
  turnCacheRead?: number
}): string {
  const cached =
    usage.turnCacheRead !== undefined && usage.turnCacheRead > 0
      ? ` (${formatTokenCount(usage.turnCacheRead)} cached)`
      : ''
  return `${formatTokenCount(usage.turnInput)} in${cached} · ${formatTokenCount(usage.turnOutput)} out`
}

/**
 * Compact session-strip metering: cost first (the honest spend signal under a
 * subscription), then last-turn input. `est.` = notional, never billed cash.
 */
export function formatUsageCompact(usage: { turnInput: number; totalCostUsd?: number }): string {
  if (usage.totalCostUsd !== undefined) {
    return `${formatCostUsd(usage.totalCostUsd)} est. · ${formatTokenCount(usage.turnInput)} in`
  }
  return `${formatTokenCount(usage.turnInput)} in`
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
 * focused, otherwise the most recently updated working thread, else the most recently
 * updated thread of any status — so the Session companion is never blank when threads
 * exist for this repo.
 */
function useRelevantThreadId(): string | null {
  const threads = useAgentThreads()
  const activeAgentThreadId = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    const tab = pane?.tabs.find((t) => t.id === pane.activeTabId)
    return tab?.kind === 'agent' ? tab.path : null
  })
  if (activeAgentThreadId !== null) return activeAgentThreadId
  if (threads.length === 0) return null
  const working = threads.filter((t) => t.status === 'working')
  const pool = working.length > 0 ? working : threads
  return pool.reduce((latest, t) => (t.updatedAt > latest.updatedAt ? t : latest)).id
}

/** Short "updated" label — coarse buckets, matches agent-list relativeTime. */
function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.round(days / 7)}w ago`
}

/**
 * Always-visible session identity for the focused (or busiest) thread: title, provider,
 * model, live status, worktree, last activity. The Activity/Plan/Files/Usage groups hide
 * when empty — this card is the Session companion's floor so Quick Access never goes blank
 * on an idle open thread.
 */
function SessionGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  const thread = useAgentThreads().find((t) => t.id === threadId)
  const liveStatus = useAgentThreadsStore((s) => s.threads[threadId]?.status)
  const remote = useActiveRemoteEnvironment()
  // Subagent-shaped tools — select the items array by identity, then derive Tasks
  // in useMemo (a filtered array every snapshot would infinite-re-render).
  const items = useAgentThreadsStore((s) => s.threads[threadId]?.items ?? EMPTY_ITEMS)
  const tasks = useMemo(
    () =>
      items.filter(
        (item): item is ToolTimelineItem => item.kind === 'tool' && item.title === 'Task',
      ),
    [items],
  )
  if (!thread) return null
  const status = liveStatus ?? thread.status
  const working = status === 'working'
  return (
    <SidebarGroup data-testid={TestIds.agentSessionCompanion} className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Session
      </SidebarGroupLabel>
      <SidebarGroupContent className="px-1">
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-2.5">
          <div className="flex items-start gap-2">
            <ProviderGlyph provider={thread.provider} className="mt-0.5 size-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{thread.title}</p>
              <p className="truncate font-mono text-2xs text-muted-foreground">
                {PROVIDER_LABEL[thread.provider]}
                {thread.model !== '' ? ` · ${thread.model}` : ''}
                {thread.mode ? ` · ${thread.mode}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
            {working ? (
              <span
                data-testid={TestIds.agentSessionCompanionStatus}
                data-status="working"
                className="flex items-center gap-1 font-medium text-foreground"
              >
                <Loader2 className="size-3 shrink-0 animate-spin" />
                Working
              </span>
            ) : thread.lastTurnFailed ? (
              <span
                data-testid={TestIds.agentSessionCompanionStatus}
                data-status="failed"
                className="font-medium text-destructive"
              >
                Last turn failed
              </span>
            ) : (
              <span data-testid={TestIds.agentSessionCompanionStatus} data-status="idle">
                Idle
              </span>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums">{relativeTime(thread.updatedAt)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span title={remote?.url ?? 'Local daemon'}>
              {remote != null ? remote.name : 'This device'}
            </span>
            {thread.worktreeBranch && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="flex min-w-0 items-center gap-0.5 truncate font-mono">
                  <GitBranch className="size-3 shrink-0" />
                  <span className="truncate">{thread.worktreeBranch}</span>
                </span>
              </>
            )}
            {thread.queued !== undefined && thread.queued.length > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{thread.queued.length} queued</span>
              </>
            )}
          </div>
          {tasks.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xs font-medium text-muted-foreground">Subagents</p>
                <p className="text-2xs tabular-nums text-muted-foreground/70">
                  {tasks.filter((t) => t.status === 'running').length} running ·{' '}
                  {tasks.filter((t) => t.status === 'ok').length} done
                  {tasks.some((t) => t.status === 'error')
                    ? ` · ${tasks.filter((t) => t.status === 'error').length} failed`
                    : ''}
                </p>
              </div>
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-1.5 text-2xs">
                  {task.status === 'running' ? (
                    <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" />
                  ) : (
                    <span
                      className={cn(
                        'mt-1 size-1.5 shrink-0 rounded-full',
                        task.status === 'error' ? 'bg-destructive' : 'bg-success',
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {task.detail?.trim() || 'Task'}
                    </p>
                    <p className="text-muted-foreground capitalize">{task.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  )
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
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-2.5">
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
          <div key={item.id} className="flex flex-col gap-1 rounded-xl border bg-card p-2.5">
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

// Re-export for tests / callers that imported from this module before the lib move.
export type { TouchedFile }
export { touchedFilesFromItems }

/**
 * Files the agent has touched in this thread — click a row to open it in the viewer
 * (and hand off to Changes for writes). The main timeline collapses tools; this is the
 * Session companion jump list (connected preview → canonical surfaces).
 */
function FilesGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  // Select the items array by identity (not a mapped TouchedFile[] — that would allocate
  // new objects every snapshot and trip useShallow into an infinite re-render loop).
  const items = useAgentThreadsStore((s) => s.threads[threadId]?.items ?? EMPTY_ITEMS)
  const files = useMemo(() => touchedFilesFromItems(items), [items])
  const repoPath = useRepoStore((s) => s.repo?.path ?? null)
  if (files.length === 0) return null

  const open = (path: string, action: TouchedFile['action']): void => {
    // Claude usually emits absolute paths; relative ones are joined to the open repo.
    const absolute =
      path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
        ? path
        : repoPath !== null
          ? `${repoPath}/${path}`
          : path
    // Writes/edits → Changes + diff tab (canonical review home); reads → file preview.
    if (action === 'edit' || action === 'write') {
      const rel =
        repoPath !== null && absolute.startsWith(`${repoPath}/`)
          ? absolute.slice(repoPath.length + 1)
          : path
      openChanges({ path: rel })
      return
    }
    openFile(absolute, true)
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
              onClick={() => open(file.path, file.action)}
              title={file.path}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none',
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  file.action === 'read' ? 'text-muted-foreground' : 'text-foreground',
                )}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {name}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground capitalize">
                {file.action}
              </span>
              {(file.action === 'edit' || file.action === 'write') && (
                <span className="sr-only">Opens Changes</span>
              )}
            </button>
          )
        })}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * The thread's accumulated token usage — last turn (with cache parenthetical when known)
 * plus a total line. Read from the daemon-owned roster (`threadInfo.usage`), so it survives
 * reloads. Hidden until the first turn reports usage (a provider that reports none stays
 * hidden forever). Cost is the primary spend signal under a subscription (notional — "est.").
 */
function UsageGroup({ threadId }: { threadId: string }): React.JSX.Element | null {
  const usage = useAgentThreads().find((t) => t.id === threadId)?.usage
  if (!usage) return null
  const totalCached =
    usage.totalCacheRead !== undefined && usage.totalCacheRead > 0
      ? ` (${formatTokenCount(usage.totalCacheRead)} cached)`
      : ''
  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Usage
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5 px-1">
        <p
          data-testid={TestIds.agentUsageLastTurn}
          className="text-2xs tabular-nums text-muted-foreground"
        >
          Last turn {formatUsageLine(usage)}
        </p>
        <p className="text-2xs tabular-nums text-muted-foreground/70">
          Total {formatTokenCount(usage.totalInput)} in{totalCached} ·{' '}
          {formatTokenCount(usage.totalOutput)} out
          {usage.totalCostUsd !== undefined && <> · {formatCostUsd(usage.totalCostUsd)} est.</>}
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
 * The Agent tab's Session companion (right sidebar): always-on session identity,
 * then plan, live activity with full command/path, files touched (click to open),
 * usage, and rate limits. Detail groups hide when empty; Session stays so Quick
 * Access is never blank for an open or recent thread. The relevant thread is the
 * active agent tab's, else the busiest working thread, else the most recent idle.
 */
export function AgentsQuickAccess(): React.JSX.Element | null {
  const threadId = useRelevantThreadId()
  const provider = useAgentThreads().find((t) => t.id === threadId)?.provider ?? null
  if (threadId === null) {
    return (
      <SidebarGroup className="px-3">
        <SidebarGroupContent className="px-1">
          <p className="rounded-xl border border-dashed bg-muted/20 p-2.5 text-2xs text-muted-foreground">
            Open or start a thread to see session status, plan, files, and usage here.
          </p>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }
  return (
    <>
      <SessionGroup threadId={threadId} />
      <ActivityGroup threadId={threadId} />
      <PlanGroup threadId={threadId} />
      <FilesGroup threadId={threadId} />
      <UsageGroup threadId={threadId} />
      {provider !== null && <LimitsGroup provider={provider} />}
    </>
  )
}

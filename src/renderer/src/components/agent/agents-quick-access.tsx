import { PlanSteps } from '@renderer/components/agent/plan-steps'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { useAgentThreads } from '@renderer/hooks/use-agents'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useTabsStore } from '@renderer/stores/tabs'
import type { TimelineItem } from '@shared/agent-protocol'
import { Loader2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

type PlanTimelineItem = Extract<TimelineItem, { kind: 'plan' }>
type ToolTimelineItem = Extract<TimelineItem, { kind: 'tool' }>

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
 * The Agent tab's Quick Access: the session at a glance — the relevant thread's plan and
 * its currently-running tool calls. Both groups hide when empty (provider install/auth
 * state lives in Settings → Agents, not here). The relevant thread is the active agent
 * tab's, else the busiest working thread.
 */
export function AgentsQuickAccess(): React.JSX.Element | null {
  const threadId = useRelevantThreadId()
  if (threadId === null) return null
  return (
    <>
      <PlanGroup threadId={threadId} />
      <RunningGroup threadId={threadId} />
    </>
  )
}

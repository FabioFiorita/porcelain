import { AgentComposer } from '@renderer/components/agent/agent-composer'
import { PlanSteps } from '@renderer/components/agent/plan-steps'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import { useAgentThreads } from '@renderer/hooks/use-agents'
import { cn } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import type { ApprovalDecision, TimelineItem } from '@shared/agent-protocol'
import { AlertTriangle, ArrowDown, Check, ChevronRight, ImageIcon, Loader2, X } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Assistant/user prose through the same pipeline as the markdown reader (react-markdown + gfm). */
function MessageMarkdown({ text }: { text: string }): React.JSX.Element {
  return (
    <article className="prose prose-sm prose-invert max-w-none prose-pre:bg-muted/40 prose-pre:text-xs prose-code:before:content-none prose-code:after:content-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {text}
      </Markdown>
    </article>
  )
}

/** Right-aligned user turn — a lit glass chip, with an image-count badge when present. */
function UserBubble({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'user' }>
}): React.JSX.Element {
  return (
    <div className="flex justify-end">
      <div className="glaze-chip max-w-[85%] rounded-2xl px-3 py-2 text-sm-minus whitespace-pre-wrap [--tile-fill:var(--surface-2)]">
        {item.text}
        {item.imageCount !== undefined && item.imageCount > 0 && (
          <span className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
            <ImageIcon className="size-3" />
            {item.imageCount} {item.imageCount === 1 ? 'image' : 'images'}
          </span>
        )}
      </div>
    </div>
  )
}

/** Full-width assistant markdown, with a streaming shimmer/caret while the turn writes. */
function AssistantMessage({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'assistant' }>
}): React.JSX.Element {
  if (item.streaming && item.text === '') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      </div>
    )
  }
  return (
    <div className="text-sm">
      <MessageMarkdown text={item.text} />
      {item.streaming && (
        <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-full bg-foreground/70 align-text-bottom" />
      )}
    </div>
  )
}

/** Collapsed reasoning: one dim italic line; click to expand the full muted text. */
function ReasoningItem({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'reasoning' }>
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const firstLine = item.text.split('\n').find((line) => line.trim() !== '') ?? ''
  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className="flex w-full items-start gap-1.5 text-left text-xs text-muted-foreground/70 italic hover:text-muted-foreground"
    >
      <ChevronRight
        className={cn('mt-0.5 size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
      />
      {expanded ? (
        <span className="min-w-0 flex-1 whitespace-pre-wrap">{item.text}</span>
      ) : (
        <span className="min-w-0 flex-1 truncate">
          {item.streaming ? 'Thinking…' : 'Thought'} {firstLine}
        </span>
      )}
    </button>
  )
}

/** Compact tool call — status dot + title + dim detail; a chevron reveals capped output. */
function ToolItem({ item }: { item: Extract<TimelineItem, { kind: 'tool' }> }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const hasOutput = item.output !== undefined && item.output !== ''
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={!hasOutput}
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-2 text-left text-xs disabled:cursor-default"
      >
        {item.status === 'running' ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : item.status === 'ok' ? (
          <Check className="size-3.5 shrink-0 text-diff-add-emphasis" />
        ) : (
          <X className="size-3.5 shrink-0 text-destructive" />
        )}
        <span className="shrink-0 font-medium text-foreground">{item.title}</span>
        {item.detail !== undefined && item.detail !== '' && (
          <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">
            {item.detail}
          </span>
        )}
        {hasOutput && (
          <ChevronRight
            className={cn(
              'ml-auto size-3 shrink-0 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
        )}
      </button>
      {expanded && hasOutput && (
        <pre className="ml-5 max-h-64 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-2xs whitespace-pre text-muted-foreground">
          {item.output}
        </pre>
      )}
    </div>
  )
}

const DECISIONS: { label: string; decision: ApprovalDecision }[] = [
  { label: 'Accept', decision: 'accept' },
  { label: 'Accept for session', decision: 'accept-session' },
  { label: 'Decline', decision: 'decline' },
]

type ApprovalStatus = Extract<TimelineItem, { kind: 'approval' }>['status']

const RESOLVED_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  canceled: 'Canceled',
}

/** Approval request card — command block + three decision buttons, locked once resolved. */
function ApprovalCard({
  item,
  threadId,
}: {
  item: Extract<TimelineItem, { kind: 'approval' }>
  threadId: string
}): React.JSX.Element {
  const { approve } = useAgentActions()
  const pending = item.status === 'pending'
  return (
    <div className="glaze-tile flex flex-col gap-2 rounded-lg p-3 [--tile-fill:var(--surface-2)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm-minus font-medium text-foreground">{item.title}</span>
        {!pending && (
          <span
            className={cn(
              'shrink-0 text-2xs uppercase tracking-wider',
              item.status === 'accepted' ? 'text-diff-add-emphasis' : 'text-muted-foreground/70',
            )}
          >
            {RESOLVED_LABEL[item.status]}
          </span>
        )}
      </div>
      {item.command !== undefined && item.command !== '' && (
        <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
          {item.command}
        </pre>
      )}
      <div className="flex flex-wrap gap-1.5">
        {DECISIONS.map(({ label, decision }) => (
          <Button
            key={decision}
            size="xs"
            disabled={!pending}
            variant={
              decision === 'accept' ? 'default' : decision === 'decline' ? 'destructive' : 'outline'
            }
            onClick={() => approve(threadId, item.requestId, decision)}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Muted destructive row for a turn error. */
function ErrorRow({ item }: { item: Extract<TimelineItem, { kind: 'error' }> }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{item.message}</span>
    </div>
  )
}

/**
 * "Working for Ns" — the elapsed-time row shown while the turn runs. The seconds tick via
 * an imperative interval writing the span's textContent (started at mount = the moment the
 * status flipped to working), NOT React state, so a long turn doesn't re-render per second.
 */
function WorkingIndicator(): React.JSX.Element {
  const spanRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const start = Date.now()
    const tick = (): void => {
      if (spanRef.current)
        spanRef.current.textContent = `${Math.floor((Date.now() - start) / 1000)}`
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 shrink-0 animate-spin" />
      Working for <span ref={spanRef}>0</span>s
    </div>
  )
}

/** The agent's checklist as a quiet card — a "Plan" header with an N/M done counter over
 *  the shared step rows (the same rows the Quick Access Plan group renders). */
function PlanItem({ item }: { item: Extract<TimelineItem, { kind: 'plan' }> }): React.JSX.Element {
  const done = item.steps.filter((step) => step.status === 'done').length
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">Plan</span>
        <span className="text-2xs text-muted-foreground">
          {done}/{item.steps.length} done
        </span>
      </div>
      <PlanSteps steps={item.steps} />
    </div>
  )
}

// Memoized: the timeline replaces items immutably (the reducer returns new arrays with
// new item objects only for what changed), so identity comparison skips re-rendering every
// prior row on each streaming delta — the tail is the only row that actually changes.
const TimelineRow = memo(function TimelineRow({
  item,
  threadId,
}: {
  item: TimelineItem
  threadId: string
}): React.JSX.Element {
  switch (item.kind) {
    case 'user':
      return <UserBubble item={item} />
    case 'assistant':
      return <AssistantMessage item={item} />
    case 'reasoning':
      return <ReasoningItem item={item} />
    case 'tool':
      return <ToolItem item={item} />
    case 'approval':
      return <ApprovalCard item={item} threadId={threadId} />
    case 'plan':
      return <PlanItem item={item} />
    case 'error':
      return <ErrorRow item={item} />
  }
})

const STICK_THRESHOLD_PX = 60

/**
 * The Agent thread viewer: the live timeline over a composer. Mounting attaches to the
 * daemon-owned thread (its snapshot seeds the store via the channel), unmounting detaches;
 * `openThread`/`closeThreadView` are ref-counted, so a split-view clone is safe. The
 * timeline auto-sticks to the bottom while a turn streams UNLESS the reader scrolled up
 * (tracked against a small threshold); a "jump to latest" pill appears while unstuck.
 */
export function AgentView({ threadId }: { threadId: string }): React.JSX.Element {
  const { openThread, closeThreadView } = useAgentActions()
  const thread = useAgentThreads().find((t) => t.id === threadId)
  const state = useAgentThreadsStore((s) => s.threads[threadId])
  const items = state?.items ?? []
  const status = state?.status ?? thread?.status ?? 'idle'
  const working = status === 'working'

  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
  const stuckRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  useEffect(() => {
    openThread(threadId)
    return () => closeThreadView(threadId)
  }, [threadId, openThread, closeThreadView])

  // Resolve the Base UI scroll viewport once (shadcn's ScrollArea doesn't forward a ref to it).
  useEffect(() => {
    viewportRef.current =
      rootRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
  }, [])

  const scrollToBottom = (): void => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
    stuckRef.current = true
    setShowJump(false)
  }

  const onScroll = (): void => {
    const viewport = viewportRef.current
    if (!viewport) return
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    const stuck = distance < STICK_THRESHOLD_PX
    stuckRef.current = stuck
    setShowJump(!stuck)
  }

  // Follow the tail while streaming, but only if the reader hasn't scrolled up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the timeline changes, not when the callback identity does.
  useEffect(() => {
    if (stuckRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight
    }
  }, [items, working])

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ScrollArea ref={rootRef} onScroll={onScroll} className="h-full">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
            {items.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground/60">
                Send a message to start the conversation.
              </p>
            ) : (
              items.map((item) => <TimelineRow key={item.id} item={item} threadId={threadId} />)
            )}
            {working && <WorkingIndicator />}
          </div>
        </ScrollArea>
        {showJump && (
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Jump to latest"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md"
          >
            <ArrowDown />
          </Button>
        )}
      </div>
      {thread && (
        <AgentComposer
          threadId={threadId}
          provider={thread.provider}
          model={thread.model}
          mode={thread.mode}
          interaction={thread.interaction ?? 'build'}
          options={thread.options}
          working={working}
        />
      )}
    </div>
  )
}

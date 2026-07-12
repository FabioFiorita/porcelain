import { AgentComposer } from '@renderer/components/agent/agent-composer'
import { PlanSteps } from '@renderer/components/agent/plan-steps'
import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import { useAgentProviders, useAgentThreads } from '@renderer/hooks/use-agents'
import { modelChipLabel } from '@renderer/lib/agent-model-label'
import { isTextEntry } from '@renderer/lib/keyboard'
import { cn, copyText } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import type { AgentProvider, ApprovalDecision, TimelineItem } from '@shared/agent-protocol'
import { PROVIDER_LABEL, TOOL_OUTPUT_CAP } from '@shared/agent-protocol'
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronRight,
  Copy,
  ImageIcon,
  Loader2,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * A ghost icon copy button revealed on hover of the block it sits in — the parent must carry
 * `group/copy relative`. Uses `copyText` (never navigator.clipboard directly — absent in the
 * tailnet browser's insecure context) and swaps to a check for ~1.5s. The `copy` group name is
 * fixed (and thus statically present for Tailwind's JIT); the copy blocks never nest, so one
 * shared name can't cross-trigger.
 */
function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    await copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy"
            onClick={copy}
            className="absolute top-1 right-1 bg-popover/70 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover/copy:opacity-100"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        }
      />
      <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}

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

/** Right-aligned user turn — a lit glass chip. Shows the persisted image thumbnails when
 *  present, else falls back to a plain image-count badge (older threads have no thumbnails). */
function UserBubble({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'user' }>
}): React.JSX.Element {
  const thumbnails = item.thumbnails ?? []
  return (
    <div className="flex justify-end">
      <div className="glaze-chip max-w-[85%] rounded-2xl px-3 py-2 text-sm-minus whitespace-pre-wrap [--tile-fill:var(--surface-2)]">
        {item.text}
        {thumbnails.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {thumbnails.map((thumb) => (
              <img
                // Content-addressed key — thumbnails are immutable base64 on a persisted item.
                key={thumb.base64}
                src={`data:${thumb.mediaType};base64,${thumb.base64}`}
                alt="Attachment"
                className="size-14 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        ) : (
          item.imageCount !== undefined &&
          item.imageCount > 0 && (
            <span className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground">
              <ImageIcon className="size-3" />
              {item.imageCount} {item.imageCount === 1 ? 'image' : 'images'}
            </span>
          )
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
    <div className="group/copy relative text-sm">
      <MessageMarkdown text={item.text} />
      {item.streaming ? (
        <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-full bg-foreground/70 align-text-bottom" />
      ) : (
        <CopyButton text={item.text} />
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
  // Drivers cap captured output at TOOL_OUTPUT_CAP; Claude/OpenCode slice exactly to it (no
  // marker) while Codex appends "…[truncated]" (so it lands past the cap). Length at/over the
  // cap is the reliable signal for all three.
  const truncated = item.output !== undefined && item.output.length >= TOOL_OUTPUT_CAP
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
        <div className="ml-5 flex flex-col gap-1">
          <div className="group/copy relative">
            <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-2xs whitespace-pre text-muted-foreground">
              {item.output}
            </pre>
            {item.output !== undefined && <CopyButton text={item.output} />}
          </div>
          {truncated && (
            <span className="text-2xs text-muted-foreground/60 italic">output truncated</span>
          )}
        </div>
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
        <div className="group/copy relative">
          <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 font-mono text-xs whitespace-pre-wrap text-foreground">
            {item.command}
          </pre>
          <CopyButton text={item.command} />
        </div>
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
 * an imperative interval writing the span's textContent, NOT React state, so a long turn
 * doesn't re-render per second. Counts from the turn's real `startedAt` (the daemon's
 * `turnStartedAt`) so opening an already-running thread shows the true elapsed time; falls
 * back to mount time only until the roster carries a start stamp.
 */
function WorkingIndicator({ startedAt }: { startedAt: number | undefined }): React.JSX.Element {
  const spanRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const start = startedAt ?? Date.now()
    const tick = (): void => {
      if (spanRef.current)
        spanRef.current.textContent = `${Math.max(0, Math.floor((Date.now() - start) / 1000))}`
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
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

// Starter prompts offered on a fresh thread — clicking one drops it into the composer.
const EXAMPLE_PROMPTS = [
  'Give me a tour of this codebase and how it fits together.',
  'Find and fix a bug in the file I have open.',
  'Add tests for the code I’m looking at.',
]

/**
 * The first-run state of an empty thread: what it's wired to (provider + model), a few starter
 * prompts that drop into the composer on click, and a one-line nudge toward Build/Plan.
 */
function EmptyTimeline({
  provider,
  model,
  resolvedModel,
  onPickPrompt,
}: {
  provider: AgentProvider
  model: string
  resolvedModel: string | undefined
  onPickPrompt: (text: string) => void
}): React.JSX.Element {
  const models = useAgentProviders().flatMap((p) => p.models)
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <ProviderGlyph provider={provider} className="size-6" />
        <p className="text-sm-minus font-medium text-foreground">{PROVIDER_LABEL[provider]}</p>
        <p className="text-2xs text-muted-foreground">
          {modelChipLabel(model, resolvedModel, models)}
        </p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPickPrompt(prompt)}
            className="glaze-chip rounded-lg px-3 py-2 text-left text-xs-minus text-muted-foreground transition-colors hover:text-foreground [--tile-fill:var(--surface-2)]"
          >
            {prompt}
          </button>
        ))}
      </div>
      <p className="max-w-md text-2xs text-muted-foreground/70">
        Tip: switch to <span className="font-medium text-muted-foreground">Plan</span> to think
        through an approach first, or stay on{' '}
        <span className="font-medium text-muted-foreground">Build</span> to make changes.
      </p>
    </div>
  )
}

/**
 * The Agent thread viewer: the live timeline over a composer. Mounting attaches to the
 * daemon-owned thread (its snapshot seeds the store via the channel), unmounting detaches;
 * `openThread`/`closeThreadView` are ref-counted, so a split-view clone is safe. The
 * timeline auto-sticks to the bottom while a turn streams UNLESS the reader scrolled up
 * (tracked against a small threshold); a "jump to latest" pill appears while unstuck.
 */
export function AgentView({ threadId }: { threadId: string }): React.JSX.Element {
  const { openThread, closeThreadView, approve } = useAgentActions()
  const thread = useAgentThreads().find((t) => t.id === threadId)
  const state = useAgentThreadsStore((s) => s.threads[threadId])
  const items = state?.items ?? []
  const status = state?.status ?? thread?.status ?? 'idle'
  const working = status === 'working'

  const rootRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLElement | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const stuckRef = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const [prefill, setPrefill] = useState<string | null>(null)
  const consumePrefill = useCallback(() => setPrefill(null), [])

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

  // Late layout shifts (image/thumbnail loads, markdown reflow) grow the content AFTER the
  // items effect ran, which would leave the tail off-screen. A ResizeObserver on the content
  // re-anchors on every such shift — but only while still stuck (respecting a reader who
  // scrolled up, exactly like the tail-follow above).
  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(() => {
      if (stuckRef.current && viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // The last still-pending approval owns Enter (accept) / Esc (decline) while it's the blocking
  // interaction. Scoped so it never fires while typing in the composer (isTextEntry) or when a
  // decision button already has focus (its own Enter handles the click).
  const pendingRequestId = [...items]
    .reverse()
    .find(
      (item): item is Extract<TimelineItem, { kind: 'approval' }> =>
        item.kind === 'approval' && item.status === 'pending',
    )?.requestId
  useEffect(() => {
    if (pendingRequestId === undefined) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      if (isTextEntry(e.target)) return
      if (e.target instanceof HTMLElement && e.target.closest('button')) return
      e.preventDefault()
      approve(threadId, pendingRequestId, e.key === 'Enter' ? 'accept' : 'decline')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingRequestId, threadId, approve])

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <ScrollArea ref={rootRef} onScroll={onScroll} className="h-full">
          <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
            {items.length === 0 ? (
              thread ? (
                <EmptyTimeline
                  provider={thread.provider}
                  model={thread.model}
                  resolvedModel={thread.resolvedModel}
                  onPickPrompt={setPrefill}
                />
              ) : null
            ) : (
              items.map((item) => <TimelineRow key={item.id} item={item} threadId={threadId} />)
            )}
            {working && <WorkingIndicator startedAt={thread?.turnStartedAt} />}
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
          resolvedModel={thread.resolvedModel}
          mode={thread.mode}
          interaction={thread.interaction ?? 'build'}
          options={thread.options}
          working={working}
          queued={thread.queued}
          prefill={prefill}
          onPrefillConsumed={consumePrefill}
        />
      )}
    </div>
  )
}

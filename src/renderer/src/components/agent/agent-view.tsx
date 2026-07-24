import { AgentComposer } from '@renderer/components/agent/agent-composer'
import {
  formatElapsed,
  formatUsageCompact,
  formatUsageLine,
} from '@renderer/components/agent/agents-quick-access'
import { PlanSteps } from '@renderer/components/agent/plan-steps'
import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { TurnChangedFiles } from '@renderer/components/agent/turn-changed-files'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAgentActions } from '@renderer/hooks/use-agent-channel'
import { useAgentProviders, useAgentThreads } from '@renderer/hooks/use-agents'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useReadFile } from '@renderer/hooks/use-files'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useActiveRemoteEnvironment } from '@renderer/hooks/use-remote-daemon'
import { estimateContextPercent } from '@renderer/lib/agent-context-window'
import { modelChipLabel } from '@renderer/lib/agent-model-label'
import { buildAgentTimeline } from '@renderer/lib/agent-timeline'
import { isTextEntry } from '@renderer/lib/keyboard'
import { classifyMarkdownImageSrc } from '@renderer/lib/markdown-image-src'
import { openChanges, openFeatureReview } from '@renderer/lib/surface-handoffs'
import { cn, copyText } from '@renderer/lib/utils'
import { useAgentThreadsStore } from '@renderer/stores/agent-threads'
import { useRepoStore } from '@renderer/stores/repo'
import type {
  AgentProvider,
  AgentUsage,
  ApprovalDecision,
  QueuedMessageInfo,
  TimelineItem,
} from '@shared/agent-protocol'
import { PROVIDER_LABEL, TOOL_OUTPUT_CAP } from '@shared/agent-protocol'
import { TestIds } from '@shared/test-ids'
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronRight,
  Copy,
  GitBranch,
  ImageIcon,
  Loader2,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
            className="absolute top-1 right-1 bg-popover text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/copy:opacity-100 [@media(hover:none)]:opacity-100"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        }
      />
      <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Chip shown when a markdown image can't be resolved (remote URL under CSP, missing
 * file, non-image path). Matches the old "paperclip + alt" failure look, but intentional.
 */
function MarkdownImageFallback({
  alt,
  detail,
}: {
  alt: string
  detail?: string
}): React.JSX.Element {
  const label = alt !== '' ? alt : (detail ?? 'Image unavailable')
  return (
    <span
      className="my-1 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground not-prose"
      title={detail}
    >
      <ImageIcon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  )
}

/**
 * Agent-timeline markdown images. Local paths (`/tmp/…`, `~/…`, `file://…`) are read
 * through the daemon as data URLs so they render under CSP (`img-src 'self' data:`);
 * raw absolute paths as `<img src>` never load (they resolve as same-origin and 404).
 */
function AgentMarkdownImage({ src, alt }: { src?: string; alt?: string }): React.JSX.Element {
  const classified = classifyMarkdownImageSrc(src)
  const localPath = classified.kind === 'local' ? classified.path : ''
  const { view, error } = useReadFile(localPath, classified.kind === 'local')
  const altText = alt ?? ''

  if (classified.kind === 'data') {
    return (
      <img
        src={classified.src}
        alt={altText}
        className="my-2 max-h-[28rem] max-w-full rounded-md border border-border object-contain"
      />
    )
  }

  if (classified.kind === 'unsupported') {
    return <MarkdownImageFallback alt={altText} detail={classified.raw || undefined} />
  }

  if (error) {
    return <MarkdownImageFallback alt={altText} detail={localPath} />
  }
  if (view === undefined) {
    return (
      <div
        role="status"
        className="my-2 h-32 max-w-md animate-pulse rounded-md border bg-muted/40 not-prose"
        aria-label="Loading image"
      />
    )
  }
  if (view.type === 'image') {
    return (
      <img
        src={view.dataUrl}
        alt={altText}
        className="my-2 max-h-[28rem] max-w-full rounded-md border border-border object-contain"
      />
    )
  }
  return <MarkdownImageFallback alt={altText} detail={localPath} />
}

/** Assistant/user prose through the same pipeline as the markdown reader (react-markdown + gfm). */
function MessageMarkdown({ text }: { text: string }): React.JSX.Element {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted/40 prose-pre:text-xs prose-code:before:content-none prose-code:after:content-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          img: ({ node: _node, src, alt }) => (
            <AgentMarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} />
          ),
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
      <div
        data-testid={TestIds.agentUserBubble}
        className="group/copy relative max-w-[85%] rounded-2xl border bg-secondary px-3 py-2 text-sm-minus whitespace-pre-wrap text-secondary-foreground"
      >
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
        {item.text !== '' && <CopyButton text={item.text} />}
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
    <div data-testid={TestIds.agentAssistantMessage} className="group/copy relative text-sm">
      <MessageMarkdown text={item.text} />
      {item.streaming ? (
        <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-full bg-foreground/70 align-text-bottom" />
      ) : (
        <CopyButton text={item.text} />
      )}
    </div>
  )
}

/** Collapsed reasoning: one dim italic line; click to expand the full muted text.
 *  Empty completed thoughts (Claude Code often redacts them) are hidden entirely;
 *  a still-streaming empty block is just a non-expandable "Thinking…" so expand never
 *  reveals a blank body. */
function ReasoningItem({
  item,
}: {
  item: Extract<TimelineItem, { kind: 'reasoning' }>
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  const firstLine = item.text.split('\n').find((line) => line.trim() !== '') ?? ''
  const hasText = firstLine !== ''
  if (!item.streaming && !hasText) return null
  if (item.streaming && !hasText) {
    return (
      <div className="flex w-full items-center gap-1.5 text-xs text-muted-foreground/70 italic">
        <Loader2 className="size-3 shrink-0 animate-spin" />
        <span>Thinking…</span>
      </div>
    )
  }
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

type ToolTimelineItem = Extract<TimelineItem, { kind: 'tool' }>

// (ToolTimelineItem also used when materializing consecutive tools outside folds.)

/** Compact tool call — status dot + title + dim detail; a chevron reveals capped output. */
function ToolItem({ item }: { item: ToolTimelineItem }): React.JSX.Element {
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
        data-testid={TestIds.agentTool(item.title)}
        className="flex items-center gap-2 text-left text-xs disabled:cursor-default"
      >
        {item.status === 'running' ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : item.status === 'ok' ? (
          <Check className="size-3.5 shrink-0 text-diff-add-emphasis" />
        ) : (
          <X className="size-3.5 shrink-0 text-destructive" />
        )}
        <span className="shrink-0 font-medium text-foreground">
          {item.title === 'Task' ? 'Subagent' : item.title}
        </span>
        {item.detail !== undefined && item.detail !== '' && (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-2xs text-muted-foreground',
              item.title === 'Task' ? 'font-medium text-foreground/80' : 'font-mono',
            )}
          >
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

/**
 * A run of consecutive tool calls collapsed to one line so a long agent turn doesn't push
 * the conversation out of view. Auto-expands while any tool is running (live action stays
 * visible); auto-collapses when the group goes fully idle so the conversation returns to
 * prose. A manual toggle sets `userToggled` so we never fight a reader who re-opened a
 * finished group (or collapsed a running one — re-running still re-expands).
 */
function ToolGroup({ tools }: { tools: ToolTimelineItem[] }): React.JSX.Element {
  const anyRunning = tools.some((t) => t.status === 'running')
  const anyError = tools.some((t) => t.status === 'error')
  const [expanded, setExpanded] = useState(anyRunning)
  const userToggledRef = useRef(false)
  const wasRunningRef = useRef(anyRunning)
  useEffect(() => {
    if (anyRunning) {
      // A new run always wins over a prior manual collapse — the live action is the point.
      setExpanded(true)
      userToggledRef.current = false
    } else if (wasRunningRef.current && !userToggledRef.current) {
      // running → idle transition, user didn't intervene: collapse so prose reclaims the view.
      setExpanded(false)
    }
    wasRunningRef.current = anyRunning
  }, [anyRunning])

  // Unique titles in order of first appearance for a compact lead-in ("Bash · Read · Edit").
  const titles: string[] = []
  for (const tool of tools) {
    if (!titles.includes(tool.title)) titles.push(tool.title)
  }
  const titleSummary = titles.slice(0, 4).join(' · ')
  const moreTitles = titles.length > 4 ? ` +${titles.length - 4}` : ''
  const running = tools.find((t) => t.status === 'running')
  const summary = anyRunning
    ? `Running ${running?.title ?? 'tool'}${running?.detail ? ` · ${running.detail}` : ''} (${tools.length})`
    : `${tools.length} tools · ${titleSummary}${moreTitles}`

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => {
          userToggledRef.current = true
          setExpanded((value) => !value)
        }}
        className="flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
        {anyRunning ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : anyError ? (
          <X className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <Check className="size-3.5 shrink-0 text-diff-add-emphasis" />
        )}
        <span className="min-w-0 flex-1 truncate">{summary}</span>
      </button>
      {expanded && (
        <div className="ml-4 flex flex-col gap-1.5 border-l border-border/60 pl-3">
          {tools.map((tool) => (
            <ToolItem key={tool.id} item={tool} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Display rows for the timeline: consecutive tools collapse into one group. */
type TimelineDisplayRow =
  | { key: string; kind: 'single'; item: TimelineItem }
  | { key: string; kind: 'tools'; tools: ToolTimelineItem[] }

/**
 * Group consecutive tool items so the conversation stays readable.
 * Task tools (Claude subagents) are never folded into an anonymous "N tools"
 * chip — each Task is its own row (title + description), then nested tools
 * under that Task are grouped until the next Task / non-tool (P2).
 * Exported for tests.
 */
export function groupTimelineItems(items: TimelineItem[]): TimelineDisplayRow[] {
  const rows: TimelineDisplayRow[] = []
  let toolBuf: ToolTimelineItem[] = []
  const flushTools = (): void => {
    if (toolBuf.length === 0) return
    if (toolBuf.length === 1) {
      const only = toolBuf[0]
      if (only) rows.push({ key: only.id, kind: 'single', item: only })
    } else {
      const first = toolBuf[0]
      if (first) rows.push({ key: `tools:${first.id}`, kind: 'tools', tools: toolBuf })
    }
    toolBuf = []
  }
  for (const item of items) {
    if (item.kind === 'tool') {
      // Subagent Task: flush prior tools, emit Task alone (always expanded detail).
      if (item.title === 'Task') {
        flushTools()
        rows.push({ key: item.id, kind: 'single', item })
        continue
      }
      toolBuf.push(item)
      continue
    }
    flushTools()
    rows.push({ key: item.id, kind: 'single', item })
  }
  flushTools()
  return rows
}

/**
 * Settled-turn chrome: collapses tools/reasoning/plan behind a “Worked for…” row
 * (T3-style). Expand to inspect the fold body; Task/subagent rows live inside.
 */
function TurnFoldRow({
  items,
  elapsedMs,
  threadId,
}: {
  items: TimelineItem[]
  elapsedMs: number | null
  threadId: string
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const bodyRows = useMemo(() => groupTimelineItems(items), [items])
  const label = elapsedMs !== null ? `Worked for ${formatElapsed(elapsedMs)}` : 'Worked'
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronRight
          className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
        />
        <span className="font-medium">{label}</span>
      </button>
      {expanded && (
        <div className="ml-2 flex flex-col gap-3 border-l border-border/60 pl-3">
          {bodyRows.map((row) =>
            row.kind === 'tools' ? (
              <ToolGroup key={row.key} tools={row.tools} />
            ) : (
              <TimelineRow key={row.key} item={row.item} threadId={threadId} />
            ),
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
    <div
      data-testid={TestIds.agentApproval}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm-minus font-medium text-foreground">{item.title}</span>
        {!pending && (
          <Badge
            variant="outline"
            data-testid={TestIds.agentApprovalStatus}
            data-status={item.status}
            className={cn(
              'shrink-0 rounded-md border-border/60 text-2xs uppercase tracking-[0.08em]',
              item.status === 'accepted' ? 'text-diff-add-emphasis' : 'text-muted-foreground/70',
            )}
          >
            {RESOLVED_LABEL[item.status]}
          </Badge>
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
            data-testid={decision === 'accept' ? TestIds.agentApprovalAccept : undefined}
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
 * "Working for 1m 40s" — the elapsed-time row shown while the turn runs. The label ticks
 * via an imperative interval writing the span's textContent, NOT React state, so a long
 * turn doesn't re-render per second. Counts from the turn's real `startedAt` (the daemon's
 * `turnStartedAt`) so opening an already-running thread shows the true elapsed time; falls
 * back to mount time only until the roster carries a start stamp. Format matches Claude
 * Code (`formatElapsed`).
 */
function WorkingIndicator({ startedAt }: { startedAt: number | undefined }): React.JSX.Element {
  const spanRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const start = startedAt ?? Date.now()
    const tick = (): void => {
      if (spanRef.current) spanRef.current.textContent = formatElapsed(Date.now() - start)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 shrink-0 animate-spin" />
      Working for <span ref={spanRef}>{formatElapsed(0)}</span>
    </div>
  )
}

/**
 * Quiet footer after the last assistant reply when the thread is idle — last-turn tokens
 * (with cache parenthetical when known). Cost lives on the session strip so this line
 * stays a lightweight "what did that turn cost in context" signal, not a bill.
 */
function TurnUsageFooter({ usage }: { usage: AgentUsage }): React.JSX.Element {
  return <p className="text-2xs tabular-nums text-muted-foreground/70">{formatUsageLine(usage)}</p>
}

/**
 * Thin session chrome above the timeline: provider + model, live status, compact usage.
 * Orientation + metering only — Plan/Activity/Files stay in Quick Access.
 */
function SessionStrip({
  provider,
  model,
  resolvedModel,
  mode,
  interaction,
  working,
  startedAt,
  usage,
  worktreeBranch,
  contextWindow,
}: {
  provider: AgentProvider
  model: string
  resolvedModel: string | undefined
  mode: string | undefined
  interaction: string | undefined
  working: boolean
  startedAt: number | undefined
  usage: AgentUsage | undefined
  worktreeBranch: string | undefined
  /** Selected context-window option (e.g. `200k`) for approximate context %. */
  contextWindow: string | undefined
}): React.JSX.Element {
  const models = useAgentProviders().flatMap((p) => p.models)
  // Env identity so a Beelink thread is never mistaken for local (P3).
  const remote = useActiveRemoteEnvironment()
  const elapsedRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!working) return
    const start = startedAt ?? Date.now()
    const tick = (): void => {
      if (elapsedRef.current) elapsedRef.current.textContent = formatElapsed(Date.now() - start)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [working, startedAt])

  const modelInfo = models.find((m) => m.id === model || m.id === resolvedModel)
  const windowOpt =
    contextWindow ?? modelInfo?.contextWindows?.default ?? modelInfo?.contextWindows?.values[0]
  const contextPct = usage !== undefined ? estimateContextPercent(usage.turnInput, windowOpt) : null

  return (
    <div
      data-testid={TestIds.agentSessionStrip}
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 px-4 py-2 text-2xs text-muted-foreground"
    >
      <ProviderGlyph provider={provider} className="size-3.5" />
      <span className="truncate font-medium text-foreground/80">
        {modelChipLabel(model, resolvedModel, models)}
      </span>
      {mode !== undefined && mode !== '' && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="capitalize">{mode}</span>
        </>
      )}
      {interaction !== undefined && interaction !== '' && interaction !== 'build' && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="capitalize">{interaction}</span>
        </>
      )}
      <span className="text-muted-foreground/40">·</span>
      {working ? (
        <span
          data-testid={TestIds.agentSessionStatus}
          data-status="working"
          className="flex items-center gap-1.5 text-foreground"
        >
          <Loader2 className="size-3 shrink-0 animate-spin" />
          Working <span ref={elapsedRef}>{formatElapsed(0)}</span>
        </span>
      ) : (
        <span data-testid={TestIds.agentSessionStatus} data-status="idle">
          Idle
        </span>
      )}
      {usage !== undefined && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="min-w-0 truncate tabular-nums">{formatUsageCompact(usage)}</span>
        </>
      )}
      {contextPct !== null && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span
            className="tabular-nums"
            title="Approximate share of the selected context window used by the last turn's input"
          >
            ~{contextPct}% context
          </span>
        </>
      )}
      {worktreeBranch && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex min-w-0 items-center gap-1 truncate font-mono">
            <GitBranch className="size-3 shrink-0" />
            <span className="truncate">{worktreeBranch}</span>
          </span>
        </>
      )}
      <span className="text-muted-foreground/40">·</span>
      <span className="truncate" title={remote?.url ?? 'Local daemon on this device'}>
        {remote != null ? remote.name : 'This device'}
      </span>
    </div>
  )
}

/**
 * Pending mid-turn sends, rendered AFTER the working indicator (and never as full user
 * bubbles) so they read as "up next when this turn ends" — not as messages that already
 * arrived after the assistant reply. Lives in the timeline, not the composer, for the same
 * reason: the composer sits under the last reply and made the chips look sent.
 */
function QueuedPendingList({
  threadId,
  queued,
}: {
  threadId: string
  queued: QueuedMessageInfo[]
}): React.JSX.Element {
  const { cancelQueued } = useAgentActions()
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-3 py-2.5">
      <p className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Up next · after this turn
      </p>
      {queued.map((item, index) => (
        <div
          key={item.id ?? `q-${item.text.slice(0, 48)}-${item.imageCount ?? 0}`}
          className="flex items-start gap-2 rounded-lg bg-background/40 px-2.5 py-2 text-xs text-muted-foreground"
        >
          <span className="mt-0.5 shrink-0 rounded-md bg-muted/70 px-1.5 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap italic text-foreground/75">
            {item.text}
          </span>
          {item.imageCount !== undefined && item.imageCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-2xs">
              <ImageIcon className="size-3" />
              {item.imageCount}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={
              queued.length > 1 ? `Cancel queued message ${index + 1}` : 'Cancel queued message'
            }
            className="size-5 shrink-0"
            onClick={() => cancelQueued(threadId, index)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}

/** The agent's checklist as a quiet card — a "Plan" header with an N/M done counter over
 *  the shared step rows (the same rows the Quick Access Plan group renders). */
function PlanItem({ item }: { item: Extract<TimelineItem, { kind: 'plan' }> }): React.JSX.Element {
  const done = item.steps.filter((step) => step.status === 'done').length
  return (
    <div
      data-testid={TestIds.agentPlan}
      className="flex flex-col gap-1.5 rounded-xl border bg-card p-2.5"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">Plan</span>
        <span
          data-testid={TestIds.agentPlanProgress}
          data-done={done}
          data-total={item.steps.length}
          className="text-2xs text-muted-foreground"
        >
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
}): React.JSX.Element | null {
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

// Starter prompts framed as Porcelain-shaped tasks (review hub, not a generic chatbot).
const EXAMPLE_PROMPTS = [
  'Review my open changes and call out anything risky.',
  'Explain the file I’m looking at and how it fits the feature.',
  'Plan a fix for the bug I’m seeing — don’t edit yet.',
]

/**
 * The first-run state of an empty thread: provider + model, a few task chips that drop into
 * the composer, and an honesty line that this is the installed CLI (same auth/project files
 * as the terminal).
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
            className="rounded-lg border bg-secondary px-3 py-2 text-left text-xs-minus text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
      <p className="max-w-md text-2xs text-muted-foreground/70">
        Uses your installed CLI — same auth and project files as the terminal. Switch to{' '}
        <span className="font-medium text-muted-foreground">Plan</span> to think first, or stay on{' '}
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
  const timelineRows = useMemo(
    () =>
      buildAgentTimeline(items, {
        working,
        turnStartedAt: thread?.turnStartedAt,
      }),
    [items, working, thread?.turnStartedAt],
  )
  // Re-collapse consecutive tools on expanded segments (live turns / no-assistant
  // timelines) so we keep the existing "N tools · Bash · Read" chrome outside folds.
  const displayTimeline = useMemo(() => {
    type Row =
      | { kind: 'turn-fold'; key: string; items: TimelineItem[]; elapsedMs: number | null }
      | { kind: 'changed-files'; key: string; writePaths: string[] }
      | { kind: 'single'; key: string; item: TimelineItem }
      | { kind: 'tools'; key: string; tools: ToolTimelineItem[] }
    const out: Row[] = []
    let toolBuf: ToolTimelineItem[] = []
    const flushTools = (): void => {
      if (toolBuf.length === 0) return
      for (const g of groupTimelineItems(toolBuf)) {
        if (g.kind === 'tools') out.push({ kind: 'tools', key: g.key, tools: g.tools })
        else out.push({ kind: 'single', key: g.key, item: g.item })
      }
      toolBuf = []
    }
    for (const row of timelineRows) {
      if (row.kind === 'item' && row.item.kind === 'tool') {
        toolBuf.push(row.item)
        continue
      }
      flushTools()
      if (row.kind === 'item') {
        out.push({ kind: 'single', key: row.key, item: row.item })
      } else if (row.kind === 'turn-fold') {
        out.push({
          kind: 'turn-fold',
          key: row.key,
          items: row.items,
          elapsedMs: row.elapsedMs,
        })
      } else {
        out.push({ kind: 'changed-files', key: row.key, writePaths: row.writePaths })
      }
    }
    flushTools()
    return out
  }, [timelineRows])

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

  // Last timeline row is an assistant reply and the turn is idle → show a quiet usage footer
  // under the conversation (tokens only; cost lives on the session strip).
  const lastItem = items[items.length - 1]
  const showTurnUsage =
    !working && thread?.usage !== undefined && lastItem?.kind === 'assistant' && !lastItem.streaming

  // Close-the-loop handoff when a turn finishes (U4) — shared surface-handoffs helpers.
  const { groups } = useGitFlow()
  const { reading } = useFeatureReading()
  const repo = useRepoStore((s) => s.repo)
  const changedCount = groups?.reduce((n, g) => n + g.files.length, 0) ?? 0
  const hasReview = reading !== null && reading !== undefined
  const showNextSteps = !working && items.length > 0 && (changedCount > 0 || hasReview)

  return (
    <div className="flex h-full flex-col">
      {thread && (
        <SessionStrip
          provider={thread.provider}
          model={thread.model}
          resolvedModel={thread.resolvedModel}
          mode={thread.mode}
          interaction={thread.interaction}
          working={working}
          startedAt={thread.turnStartedAt}
          usage={thread.usage}
          worktreeBranch={thread.worktreeBranch}
          contextWindow={thread.options?.contextWindow}
        />
      )}
      {showNextSteps && repo && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2 text-2xs">
          <span className="text-muted-foreground">Next</span>
          {changedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => openChanges({ continuousReview: true })}
            >
              {changedCount} changed · All changes
            </Button>
          )}
          {hasReview && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => openFeatureReview()}
            >
              Open Review
            </Button>
          )}
          {changedCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openChanges()}>
              Commit
            </Button>
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <ScrollArea ref={rootRef} onScroll={onScroll} className="h-full">
          <div
            ref={contentRef}
            data-testid={TestIds.agentTimeline}
            className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4"
          >
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
              displayTimeline.map((row) => {
                if (row.kind === 'turn-fold') {
                  return (
                    <TurnFoldRow
                      key={row.key}
                      items={row.items}
                      elapsedMs={row.elapsedMs}
                      threadId={threadId}
                    />
                  )
                }
                if (row.kind === 'changed-files') {
                  return (
                    <TurnChangedFiles key={row.key} writePaths={row.writePaths} groups={groups} />
                  )
                }
                if (row.kind === 'tools') {
                  return <ToolGroup key={row.key} tools={row.tools} />
                }
                return <TimelineRow key={row.key} item={row.item} threadId={threadId} />
              })
            )}
            {working && <WorkingIndicator startedAt={thread?.turnStartedAt} />}
            {showTurnUsage && thread.usage !== undefined && (
              <TurnUsageFooter usage={thread.usage} />
            )}
            {thread?.queued !== undefined && thread.queued.length > 0 && (
              <QueuedPendingList threadId={threadId} queued={thread.queued} />
            )}
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
          prefill={prefill}
          onPrefillConsumed={consumePrefill}
        />
      )}
    </div>
  )
}

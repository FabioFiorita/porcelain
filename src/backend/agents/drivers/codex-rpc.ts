import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  type AgentEvent,
  type AgentImage,
  type AgentMode,
  type ApprovalDecision,
  type ModelInfo,
  type ProviderLimits,
  type ProviderLimitWindow,
  type TimelineItem,
  TOOL_OUTPUT_CAP,
} from '../../../shared/agent-protocol'

/**
 * The pure protocol + translation layer for the Codex driver — everything that can be
 * exercised without a live `codex app-server`. The impure driver (`codex.ts`) owns the
 * child process, the RPC round-trips, and the per-turn routing; this module owns the
 * wire framing, the parse of an inbound line into one of three JSON-RPC shapes, and the
 * translation of Codex's notification/approval vocabulary into normalized `AgentEvent`s.
 *
 * WHY the framing looks odd: `codex app-server` speaks NDJSON JSON-RPC **without the
 * `jsonrpc: "2.0"` envelope field** — a strict JSON-RPC 2.0 client would reject its
 * frames. It is also **bidirectional**: the server sends US requests (with an `id` and a
 * `method`) when a command/patch needs approval, and we answer them with a normal
 * `result` response. So a line is one of: a response to our request (`id` + `result`/
 * `error`), a request FROM the server (`id` + `method`), or a notification (`method`, no
 * `id`). `parseIncoming` classifies it; everything else drops (see the driver's
 * log-and-drop handler and `translateNotification`, which never throws on a bad shape).
 */

// ── Framing ────────────────────────────────────────────────────────────────────────

// A JSON-RPC id is a string or an int64 in this protocol (both directions issue
// requests, so ids from the server can be either). We keep it as-is for correlation.
export type RpcId = string | number

/** Encode one outbound message as an NDJSON line (note: NO `jsonrpc` field — see above). */
export function encodeMessage(message: Record<string, unknown>): string {
  return `${JSON.stringify(message)}\n`
}

/**
 * Reassembles `\n`-delimited lines from an arbitrarily-chunked stdout stream. A chunk
 * can split mid-line or carry several lines; `push` returns the complete lines it can
 * emit and buffers the trailing partial for the next chunk.
 */
export class LineDecoder {
  private buffer = ''

  push(chunk: string): string[] {
    this.buffer += chunk
    const lines: string[] = []
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      lines.push(this.buffer.slice(0, index))
      this.buffer = this.buffer.slice(index + 1)
      index = this.buffer.indexOf('\n')
    }
    return lines
  }
}

const rpcIdSchema = z.union([z.string(), z.number()])

// Inbound lines are network input (loopback stdio, but still an external process owns
// the far end) — validate the envelope and drop anything malformed, exactly as
// session.ts tolerates bad WS frames.
const incomingSchema = z.object({
  id: rpcIdSchema.optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z
    .object({ code: z.number(), message: z.string(), data: z.unknown().optional() })
    .optional(),
})

export type Incoming =
  | { kind: 'response'; id: RpcId; result?: unknown; error?: { code: number; message: string } }
  | { kind: 'request'; id: RpcId; method: string; params: unknown }
  | { kind: 'notification'; method: string; params: unknown }

/** Parse and classify one inbound line; `null` for any malformed/unclassifiable frame. */
export function parseIncoming(line: string): Incoming | null {
  let json: unknown
  try {
    json = JSON.parse(line)
  } catch {
    return null
  }
  const parsed = incomingSchema.safeParse(json)
  if (!parsed.success) return null
  const { id, method, result, error } = parsed.data
  // Request FROM the server (an approval): has both an id and a method.
  if (id !== undefined && method !== undefined) {
    return { kind: 'request', id, method, params: parsed.data.params }
  }
  // Response to one of our requests: an id but no method.
  if (id !== undefined) {
    return error ? { kind: 'response', id, error } : { kind: 'response', id, result }
  }
  // Notification: a method but no id.
  if (method !== undefined) return { kind: 'notification', method, params: parsed.data.params }
  return null
}

// ── Routing ─────────────────────────────────────────────────────────────────────────

// Notifications carry their thread/turn ids in a few different shapes (top-level for
// item/* events, nested under `thread`/`turn` for lifecycle events). Read them
// leniently — a missing key just yields undefined and the driver drops the event.
const routingSchema = z.object({
  threadId: z.string().optional(),
  turnId: z.string().optional(),
  thread: z.object({ id: z.string() }).optional(),
  turn: z.object({ id: z.string() }).optional(),
})

export function routingKeys(params: unknown): { threadId?: string; turnId?: string } {
  const parsed = routingSchema.safeParse(params)
  if (!parsed.success) return {}
  const { threadId, turnId, thread, turn } = parsed.data
  return { threadId: threadId ?? thread?.id, turnId: turnId ?? turn?.id }
}

// ── Mode → approval policy + sandbox ─────────────────────────────────────────────────

export type CodexApprovalPolicy = 'untrusted' | 'on-request' | 'never'
export type CodexSandbox = 'read-only' | 'workspace-write' | 'danger-full-access'

/**
 * Map Porcelain's three permission postures onto Codex's approval policy + sandbox:
 *   approve    → on-request + workspace-write  (the CLI asks before each command/patch)
 *   auto-edits → never      + workspace-write  (edits within the workspace, no prompts)
 *   full       → never      + danger-full-access (no gate, no sandbox)
 * `sandbox` (a SandboxMode name) and a named `permissions` profile are mutually
 * exclusive on Codex, so we only ever send `sandbox`.
 */
export function modeToPolicy(mode: AgentMode): {
  approvalPolicy: CodexApprovalPolicy
  sandbox: CodexSandbox
} {
  switch (mode) {
    case 'approve':
      return { approvalPolicy: 'on-request', sandbox: 'workspace-write' }
    case 'auto-edits':
      return { approvalPolicy: 'never', sandbox: 'workspace-write' }
    case 'full':
      return { approvalPolicy: 'never', sandbox: 'danger-full-access' }
  }
}

/**
 * Build the `thread/start` request params. `model` is OMITTED when empty — an empty string
 * means "the CLI's own default", and sending `model: ''` verbatim makes the server pick a
 * bogus/empty model. Kept pure (and separate from the driver's RPC plumbing) so it's testable.
 */
export function buildThreadStartParams(opts: {
  cwd: string
  model: string
  approvalPolicy: CodexApprovalPolicy
  sandbox: CodexSandbox
}): Record<string, unknown> {
  return {
    cwd: opts.cwd,
    ...(opts.model !== '' ? { model: opts.model } : {}),
    approvalPolicy: opts.approvalPolicy,
    sandbox: opts.sandbox,
  }
}

/** Build the `thread/resume` request params. Same empty-model omission as thread/start. */
export function buildThreadResumeParams(opts: {
  threadId: string
  cwd: string
  model: string
  approvalPolicy: CodexApprovalPolicy
  sandbox: CodexSandbox
}): Record<string, unknown> {
  return {
    threadId: opts.threadId,
    cwd: opts.cwd,
    ...(opts.model !== '' ? { model: opts.model } : {}),
    approvalPolicy: opts.approvalPolicy,
    sandbox: opts.sandbox,
    excludeTurns: true,
  }
}

// ── User input (incl. images) ────────────────────────────────────────────────────────

export type CodexUserInput =
  | { type: 'text'; text: string; text_elements: [] }
  | { type: 'image'; url: string }

/**
 * Build Codex's `UserInput[]` from the message text + attached images. Images arrive as
 * base64 (the thread may live on a remote daemon, so we never have a local path); we
 * send them as `image` inputs with a `data:` URL rather than writing a temp file.
 */
export function buildUserInput(text: string, images: AgentImage[]): CodexUserInput[] {
  const input: CodexUserInput[] = [{ type: 'text', text, text_elements: [] }]
  for (const image of images) {
    input.push({ type: 'image', url: `data:${image.mediaType};base64,${image.base64}` })
  }
  return input
}

/**
 * Build the `turn/start` request params. `effort` is a genuine per-turn `ReasoningEffort`
 * override (it also sticks to subsequent turns on the thread) and is OMITTED when empty so
 * the thread keeps its catalog default. Kept pure (separate from the driver's RPC plumbing)
 * so the param shape is testable. Codex exposes no per-turn context-window control, so the
 * thread's `contextWindow` option never reaches here.
 *
 * Plan mode rides `collaborationMode` (EXPERIMENTAL in the 0.144.1 app-server schema, but
 * real — `TurnStartParams.collaborationMode: { mode: 'plan'|'default', settings }`; t3code
 * ships it): `{ mode: 'plan', settings: { model, reasoning_effort, developer_instructions } }`.
 * `developer_instructions: null` = "use the built-in instructions for the selected mode"
 * (per the schema doc), so we send null instead of authoring our own plan prompt. The
 * `settings.model` field is REQUIRED, so when the thread has no explicit model ('' = CLI
 * default) we can't name one and must skip the collaborationMode (the toggle is a no-op on
 * codex until a model is picked) rather than guess a slug that rots with CLI versions.
 * In 'build' we omit the field entirely — absent means the server's default mode.
 */
export function buildTurnStartParams(opts: {
  threadId: string
  input: CodexUserInput[]
  effort?: string
  model?: string
  interaction?: 'build' | 'plan'
}): Record<string, unknown> {
  const effort = opts.effort !== undefined && opts.effort !== '' ? opts.effort : undefined
  const collaborationMode =
    opts.interaction === 'plan' && opts.model !== undefined && opts.model !== ''
      ? {
          mode: 'plan',
          settings: {
            model: opts.model,
            reasoning_effort: effort ?? null,
            developer_instructions: null,
          },
        }
      : undefined
  return {
    threadId: opts.threadId,
    input: opts.input,
    ...(effort !== undefined ? { effort } : {}),
    ...(collaborationMode !== undefined ? { collaborationMode } : {}),
  }
}

// ── Approval decisions (client → server response) ────────────────────────────────────

// v2 approval requests (item/commandExecution|fileChange/requestApproval) take a
// CommandExecutionApprovalDecision / FileChangeApprovalDecision; the legacy v1 requests
// (execCommandApproval / applyPatchApproval) take a ReviewDecision. Same three human
// choices, two vocabularies — `accept-session` is Codex's session-scoped accept.
export function toV2Decision(
  decision: ApprovalDecision,
): 'accept' | 'acceptForSession' | 'decline' {
  switch (decision) {
    case 'accept':
      return 'accept'
    case 'accept-session':
      return 'acceptForSession'
    case 'decline':
      return 'decline'
  }
}

export function toLegacyDecision(
  decision: ApprovalDecision,
): 'approved' | 'approved_for_session' | 'denied' {
  switch (decision) {
    case 'accept':
      return 'approved'
    case 'accept-session':
      return 'approved_for_session'
    case 'decline':
      return 'denied'
  }
}

/** Which approval vocabulary a given server-request method speaks. */
export function isLegacyApprovalMethod(method: string): boolean {
  return method === 'execCommandApproval' || method === 'applyPatchApproval'
}

export const APPROVAL_METHODS = new Set([
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'execCommandApproval',
  'applyPatchApproval',
])

// ── Model catalog ─────────────────────────────────────────────────────────────────────

const modelSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  // Codex advertises its reasoning-effort catalog per model (open enum); we surface it as
  // ModelInfo.efforts so the picker offers exactly what this model accepts.
  supportedReasoningEfforts: z.array(z.object({ reasoningEffort: z.string() })).optional(),
  defaultReasoningEffort: z.string().optional(),
})
const modelListSchema = z.object({
  data: z.array(modelSchema),
  nextCursor: z.string().nullish(),
})

/** Parse a `model/list` result into ModelInfo rows, or null if the shape is off. */
export function parseModelList(
  result: unknown,
): { models: ModelInfo[]; nextCursor: string | null } | null {
  const parsed = modelListSchema.safeParse(result)
  if (!parsed.success) return null
  const models = parsed.data.data.map((model): ModelInfo => {
    const description = model.description
    // Build the effort descriptor only when the model advertises a non-empty set (an empty
    // list hides the control). Default to the model's own default, else the first value.
    const effortValues = (model.supportedReasoningEfforts ?? []).map((e) => e.reasoningEffort)
    const efforts =
      effortValues.length > 0
        ? { values: effortValues, default: model.defaultReasoningEffort ?? effortValues[0] }
        : undefined
    return {
      id: model.id,
      label: model.displayName ?? model.id,
      provider: 'codex',
      ...(description !== undefined ? { description } : {}),
      ...(efforts !== undefined ? { efforts } : {}),
    }
  })
  return { models, nextCursor: parsed.data.nextCursor ?? null }
}

// ── Auth / account ────────────────────────────────────────────────────────────────────

const authStatusSchema = z.object({ authMethod: z.string().nullish() })
const accountSchema = z.object({
  account: z
    .object({ type: z.string(), email: z.string().nullish(), planType: z.string().nullish() })
    .nullish(),
})

/** `getAuthStatus` → is Codex logged in at all. */
export function parseAuthenticated(result: unknown): boolean {
  const parsed = authStatusSchema.safeParse(result)
  return parsed.success && parsed.data.authMethod != null
}

/** `account/read` → a human account label (email, else plan, else account type). */
export function parseAccountLabel(result: unknown): string | undefined {
  const parsed = accountSchema.safeParse(result)
  if (!parsed.success || !parsed.data.account) return undefined
  const { email, planType, type } = parsed.data.account
  return email ?? planType ?? type
}

// ── Rate limits ───────────────────────────────────────────────────────────────────────

/**
 * A single Codex rate-limit window. Codex doesn't name windows "5h/weekly/monthly" — it
 * gives `windowDurationMins` on `primary`/`secondary`, so we derive the id/label from the
 * duration (300→5h, 10080→weekly, 43200→monthly; anything else → "Xd" by days). `usedPercent`
 * is 0–100; `resetsAt` is epoch SECONDS (we convert to ms below). Read leniently.
 */
const rateLimitWindowSchema = z.object({
  usedPercent: z.number(),
  windowDurationMins: z.number().nullish(),
  resetsAt: z.number().nullish(),
})
const rateLimitSnapshotSchema = z.object({
  primary: rateLimitWindowSchema.nullish(),
  secondary: rateLimitWindowSchema.nullish(),
  planType: z.string().nullish(),
})
export type CodexRateLimitSnapshot = z.infer<typeof rateLimitSnapshotSchema>

// `account/rateLimits/read` → the current snapshot (the `rateLimits` back-compat bucket).
const getRateLimitsResponseSchema = z.object({ rateLimits: rateLimitSnapshotSchema })
// `account/rateLimits/updated` → a sparse rolling snapshot to merge into the last read.
const rateLimitsUpdatedSchema = z.object({ rateLimits: rateLimitSnapshotSchema })

/** Parse `account/rateLimits/read`'s result into a snapshot, or null if the shape is off. */
export function parseRateLimitsResponse(result: unknown): CodexRateLimitSnapshot | null {
  const parsed = getRateLimitsResponseSchema.safeParse(result)
  return parsed.success ? parsed.data.rateLimits : null
}

/** Parse an `account/rateLimits/updated` notification's params into a snapshot, or null. */
export function parseRateLimitsUpdated(params: unknown): CodexRateLimitSnapshot | null {
  const parsed = rateLimitsUpdatedSchema.safeParse(params)
  return parsed.success ? parsed.data.rateLimits : null
}

/**
 * Merge a sparse rolling `account/rateLimits/updated` snapshot into the last full read:
 * each field is taken from the update when present, else kept from the base. Codex sends
 * these mid-turn ("merge into the last read snapshot"), so a push that only carries
 * `primary` mustn't wipe a previously-read `secondary`.
 */
export function mergeRateLimitSnapshot(
  base: CodexRateLimitSnapshot | null,
  update: CodexRateLimitSnapshot,
): CodexRateLimitSnapshot {
  if (!base) return update
  return {
    primary: update.primary ?? base.primary,
    secondary: update.secondary ?? base.secondary,
    planType: update.planType ?? base.planType,
  }
}

/** Derive a normalized window id + label from Codex's `windowDurationMins` (minutes). */
function windowIdentity(durationMins: number | null | undefined): { id: string; label: string } {
  switch (durationMins) {
    case 300:
      return { id: '5h', label: '5-hour' }
    case 10080:
      return { id: 'weekly', label: 'Weekly' }
    case 43200:
      return { id: 'monthly', label: 'Monthly' }
    default: {
      // Unknown duration → label by whole days when we can, else a generic id.
      if (durationMins == null || durationMins <= 0) return { id: 'window', label: 'Usage' }
      const days = Math.round(durationMins / 1440)
      return days >= 1 ? { id: `${days}d`, label: `${days}d` } : { id: 'window', label: 'Usage' }
    }
  }
}

/**
 * Map a Codex rate-limit snapshot into the normalized `ProviderLimits`. `primary` (short
 * window) and `secondary` (long window) become windows labeled by their duration, with
 * `resetsAt` converted from epoch seconds to ms. A null window is skipped; `planType`
 * carries through as the plan label. Returns null when there are no windows at all (an
 * API-key account reports empty windows, so there's nothing to show).
 */
export function snapshotToLimits(snapshot: CodexRateLimitSnapshot): ProviderLimits | null {
  const windows: ProviderLimitWindow[] = []
  for (const window of [snapshot.primary, snapshot.secondary]) {
    if (!window) continue
    const { id, label } = windowIdentity(window.windowDurationMins)
    windows.push({
      id,
      label,
      usedPercent: window.usedPercent,
      ...(window.resetsAt != null ? { resetsAt: window.resetsAt * 1000 } : {}),
    })
  }
  if (windows.length === 0) return null
  return { windows, ...(snapshot.planType != null ? { plan: snapshot.planType } : {}) }
}

// ── Thread / turn handshake results ───────────────────────────────────────────────────

const threadStartSchema = z.object({ thread: z.object({ id: z.string() }) })
const turnStartSchema = z.object({ turn: z.object({ id: z.string() }) })

export function parseThreadId(result: unknown): string | null {
  const parsed = threadStartSchema.safeParse(result)
  return parsed.success ? parsed.data.thread.id : null
}

export function parseTurnId(result: unknown): string | null {
  const parsed = turnStartSchema.safeParse(result)
  return parsed.success ? parsed.data.turn.id : null
}

// ── Notification → AgentEvent translation ─────────────────────────────────────────────

/** Cap a captured tool output so one runaway command can't bloat the persisted thread. */
function capOutput(output: string): string {
  if (output.length <= TOOL_OUTPUT_CAP) return output
  return `${output.slice(0, TOOL_OUTPUT_CAP)}\n…[truncated]`
}

function firstLine(text: string, max = 80): string {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

// The subset of a ThreadItem the timeline needs. Codex's real item union is ~20 variants
// with many fields; we read the handful that map onto a normalized item and ignore the
// rest (webSearch, sleep, subAgent…), so an unknown item type just produces no event.
const threadItemSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  text: z.string().optional(),
  command: z.string().optional(),
  cwd: z.string().optional(),
  status: z.string().optional(),
  aggregatedOutput: z.string().nullish(),
  summary: z.array(z.string()).optional(),
  content: z.array(z.string()).optional(),
  changes: z.array(z.object({ path: z.string(), diff: z.string().optional() })).optional(),
  server: z.string().optional(),
  tool: z.string().optional(),
})
type ThreadItem = z.infer<typeof threadItemSchema>

// A command/patch item's Codex status → the normalized tool status. `inProgress` while
// running; `declined`/`failed` are errors; `completed` is ok.
function toolStatus(status: string | undefined, completed: boolean): 'running' | 'ok' | 'error' {
  if (!completed) return 'running'
  if (status === 'failed' || status === 'declined') return 'error'
  return 'ok'
}

function reasoningText(item: ThreadItem): string {
  const parts = [...(item.summary ?? []), ...(item.content ?? [])].filter((part) => part !== '')
  return parts.join('\n\n')
}

// Turn one ThreadItem (from item/started or item/completed) into at most one AgentEvent.
// `completed=false` marks streaming items still open (assistant/reasoning stay
// `streaming: true` so their deltas keep appending until item/completed re-emits them).
function itemToEvent(raw: unknown, completed: boolean): AgentEvent | null {
  const parsed = threadItemSchema.safeParse(raw)
  if (!parsed.success) return null
  const item = parsed.data
  const id = item.id
  if (id === undefined) return null
  switch (item.type) {
    // The manager already appended the user item on send — never echo Codex's copy.
    case 'userMessage':
      return null
    case 'agentMessage':
      return {
        t: 'item',
        item: { kind: 'assistant', id, text: item.text ?? '', streaming: !completed },
      }
    case 'reasoning':
      return {
        t: 'item',
        item: { kind: 'reasoning', id, text: reasoningText(item), streaming: !completed },
      }
    case 'commandExecution': {
      const output =
        completed && item.aggregatedOutput ? capOutput(item.aggregatedOutput) : undefined
      return {
        t: 'item',
        item: {
          kind: 'tool',
          id,
          title: item.command ? firstLine(item.command) : 'Run command',
          ...(item.cwd !== undefined ? { detail: item.cwd } : {}),
          status: toolStatus(item.status, completed),
          ...(output !== undefined ? { output } : {}),
        },
      }
    }
    case 'fileChange': {
      const changes = item.changes ?? []
      const title =
        changes.length === 1 ? `Edit ${changes[0].path}` : `Edit ${changes.length} files`
      const diff = changes
        .map((change) => change.diff ?? '')
        .filter((part) => part !== '')
        .join('\n')
      const output = completed && diff !== '' ? capOutput(diff) : undefined
      return {
        t: 'item',
        item: {
          kind: 'tool',
          id,
          title,
          status: toolStatus(item.status, completed),
          ...(output !== undefined ? { output } : {}),
        },
      }
    }
    case 'mcpToolCall':
      return {
        t: 'item',
        item: {
          kind: 'tool',
          id,
          title: `${item.server ?? 'mcp'}/${item.tool ?? 'tool'}`,
          status: toolStatus(item.status, completed),
        },
      }
    default:
      return null
  }
}

const deltaSchema = z.object({ itemId: z.string(), delta: z.string() })
const turnCompletedSchema = z.object({
  turn: z.object({
    id: z.string().optional(),
    status: z.string(),
    error: z.object({ message: z.string() }).nullish(),
  }),
})
const errorNotificationSchema = z.object({
  error: z.object({ message: z.string() }),
  willRetry: z.boolean().optional(),
  turnId: z.string().optional(),
})
const tokenUsageSchema = z.object({
  tokenUsage: z.object({
    last: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
  }),
})
// `turn/plan/updated` (TurnPlanUpdatedNotification): the whole plan each time, so we upsert
// one plan item. Codex's step status vocabulary is pending/inProgress/completed.
const planUpdatedSchema = z.object({
  plan: z.array(z.object({ step: z.string(), status: z.string() })),
})

function codexPlanStatus(status: string): 'pending' | 'active' | 'done' {
  if (status === 'inProgress') return 'active'
  if (status === 'completed') return 'done'
  return 'pending'
}

/**
 * The result of translating one server notification: the timeline events it produces
 * plus, for a terminal notification, the `done` signal the driver relays to `onDone`.
 * Pure and total — an unrecognized method or a malformed payload yields no events (never
 * throws), so a stray/unexpected notification is silently dropped.
 */
export interface Translated {
  events: AgentEvent[]
  done?: { ok: boolean }
}

export function translateNotification(method: string, params: unknown): Translated {
  switch (method) {
    case 'item/started': {
      const started = z.object({ item: z.unknown() }).safeParse(params)
      const event = started.success ? itemToEvent(started.data.item, false) : null
      return { events: event ? [event] : [] }
    }
    case 'item/completed': {
      const done = z.object({ item: z.unknown() }).safeParse(params)
      const event = done.success ? itemToEvent(done.data.item, true) : null
      return { events: event ? [event] : [] }
    }
    case 'item/agentMessage/delta':
    case 'item/reasoning/textDelta':
    case 'item/reasoning/summaryTextDelta': {
      const delta = deltaSchema.safeParse(params)
      if (!delta.success) return { events: [] }
      return { events: [{ t: 'item-delta', id: delta.data.itemId, delta: delta.data.delta }] }
    }
    case 'thread/tokenUsage/updated': {
      const usage = tokenUsageSchema.safeParse(params)
      const last = usage.success ? usage.data.tokenUsage.last : undefined
      if (!last) return { events: [] }
      return {
        events: [
          {
            t: 'status',
            status: 'working',
            usage: { inputTokens: last.inputTokens, outputTokens: last.outputTokens },
          },
        ],
      }
    }
    case 'turn/plan/updated': {
      const plan = planUpdatedSchema.safeParse(params)
      if (!plan.success) return { events: [] }
      const steps = plan.data.plan.map((s) => ({ text: s.step, status: codexPlanStatus(s.status) }))
      return { events: [{ t: 'item', item: { kind: 'plan', id: 'plan', steps } }] }
    }
    case 'turn/completed': {
      const completed = turnCompletedSchema.safeParse(params)
      if (!completed.success) return { events: [], done: { ok: true } }
      const { turn } = completed.data
      if (turn.status === 'failed') {
        const message = turn.error?.message ?? 'The turn failed.'
        return {
          events: [
            { t: 'item', item: { kind: 'error', id: `error:${turn.id ?? randomUUID()}`, message } },
          ],
          done: { ok: false },
        }
      }
      return { events: [], done: { ok: true } }
    }
    case 'error': {
      const parsed = errorNotificationSchema.safeParse(params)
      if (!parsed.success) return { events: [] }
      // A retryable error is transient — Codex will keep going, so don't end the turn.
      if (parsed.data.willRetry) return { events: [] }
      return {
        events: [
          {
            t: 'item',
            item: {
              kind: 'error',
              id: `error:${parsed.data.turnId ?? randomUUID()}`,
              message: parsed.data.error.message,
            },
          },
        ],
        done: { ok: false },
      }
    }
    default:
      return { events: [] }
  }
}

// ── Approval requests (server → client) ───────────────────────────────────────────────

const commandApprovalSchema = z.object({ command: z.string().nullish(), cwd: z.string().nullish() })

/**
 * Turn a server approval request into a pending `approval` timeline item. `requestId` is
 * the JSON-RPC request id (stringified) — the human's decision is later routed back to
 * that exact server request by `respondApproval`. The command (for an exec approval) is
 * carried as the item's `command` so the UI can show what it's about to run.
 */
export function buildApprovalItem(
  requestId: string,
  method: string,
  params: unknown,
): { t: 'item'; item: Extract<TimelineItem, { kind: 'approval' }> } {
  if (method === 'item/fileChange/requestApproval' || method === 'applyPatchApproval') {
    return {
      t: 'item',
      item: {
        kind: 'approval',
        id: requestId,
        requestId,
        title: 'Apply file changes',
        status: 'pending',
      },
    }
  }
  const parsed = commandApprovalSchema.safeParse(params)
  const command = parsed.success ? (parsed.data.command ?? undefined) : undefined
  return {
    t: 'item',
    item: {
      kind: 'approval',
      id: requestId,
      requestId,
      title: command ? `Run: ${firstLine(command)}` : 'Approve command',
      ...(command !== undefined ? { command } : {}),
      status: 'pending',
    },
  }
}

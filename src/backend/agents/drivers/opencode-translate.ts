import { randomUUID } from 'node:crypto'
import type { AgentEvent, AgentMode, TimelineItem } from '../../../shared/agent-protocol'
import { TOOL_OUTPUT_CAP } from '../../../shared/agent-protocol'

/**
 * Pure translation from opencode's SSE event vocabulary into Porcelain's normalized
 * `AgentEvent`s. Kept out of the driver (`opencode.ts`, which owns the impure spawn +
 * fetch/SSE plumbing) so every mapping decision — SSE line framing, part→item routing,
 * delta accumulation, permission→mode mapping — is unit-testable against captured JSON
 * with no server. Tolerant by construction: a malformed or unrecognized frame yields no
 * events rather than throwing, so one bad line can never abort a turn.
 *
 * Ground truth: opencode 1.17.18 `GET /event` (legacy coarse names — `message.updated`,
 * `message.part.updated`, `message.part.delta`, `session.idle`, `session.error`,
 * `permission.asked`). See scratchpad/protocol-opencode.md §5.
 */

// A raw SSE frame: every opencode event is `{id, type, properties}` discriminated by the
// dotted `type`. We keep `properties` opaque and narrow each field defensively — the wire
// shape is large and versioned, and we only touch the handful of fields a turn needs.
export interface OpencodeRawEvent {
  type: string
  properties?: Record<string, unknown>
}

// --- tolerant accessors (no `any`, no casts) --------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * Frame the raw SSE byte stream into events. Callers accumulate decoded text in `buffer`
 * and feed it here; we split on newlines, keep only `data:` lines, JSON-parse each, and
 * return the leftover partial line as `rest` for the next chunk. A line that isn't valid
 * JSON (or lacks a string `type`) is dropped — SSE is line-oriented, so a torn frame just
 * completes on the next read.
 */
export function drainSseLines(buffer: string): { events: OpencodeRawEvent[]; rest: string } {
  const events: OpencodeRawEvent[] = []
  let rest = buffer
  let newline = rest.indexOf('\n')
  while (newline !== -1) {
    const line = rest.slice(0, newline).trimEnd() // trimEnd handles CRLF (\r\n) frames
    rest = rest.slice(newline + 1)
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim()
      if (payload !== '') {
        const parsed = parseFrame(payload)
        if (parsed) events.push(parsed)
      }
    }
    newline = rest.indexOf('\n')
  }
  return { events, rest }
}

function parseFrame(payload: string): OpencodeRawEvent | null {
  try {
    const value: unknown = JSON.parse(payload)
    const record = asRecord(value)
    const type = record ? asString(record.type) : undefined
    if (!record || type === undefined) return null
    const properties = asRecord(record.properties)
    return { type, properties: properties ?? {} }
  } catch {
    return null // WHY: malformed/partial JSON is dropped, never thrown (turn must not die)
  }
}

// --- permission decisions ---------------------------------------------------------------

// opencode's reply verbs: `once` = allow this call, `always` = allow + persist for the
// session, `reject` = deny. See protocol-opencode.md §6.
export type OpencodePermissionResponse = 'once' | 'always' | 'reject'

/**
 * Map the human's approval decision onto opencode's reply verb. `accept-session` becomes
 * `always` (persist), a bare `accept` becomes `once`, `decline` becomes `reject`.
 */
export function permissionResponseFor(
  decision: 'accept' | 'accept-session' | 'decline',
): OpencodePermissionResponse {
  switch (decision) {
    case 'accept':
      return 'once'
    case 'accept-session':
      return 'always'
    case 'decline':
      return 'reject'
  }
}

// --- the translator ---------------------------------------------------------------------

/**
 * What a single handled frame asks the driver to do. `events` are emitted verbatim;
 * `autoApprovePermissionId` tells the driver to POST an allow reply (auto modes);
 * `done` ends the turn exactly once.
 */
export interface TranslateResult {
  events: AgentEvent[]
  autoApprovePermissionId?: string
  done?: { ok: boolean }
}

interface StreamingPart {
  itemId: string
  kind: 'assistant' | 'reasoning'
  text: string
}

interface PendingApproval {
  title: string
  command?: string
}

export interface OpencodeTranslator {
  /** Translate one raw SSE frame into driver actions. Never throws. */
  handle(raw: OpencodeRawEvent): TranslateResult
  /** Close any open streaming assistant/reasoning items (turn end / abort). */
  finalize(): AgentEvent[]
  /** Resolve a pending approval item after the human answered (approve mode). */
  resolveApproval(
    requestId: string,
    decision: 'accept' | 'accept-session' | 'decline',
  ): AgentEvent[]
}

/**
 * Create a stateful translator for one turn. Holds the minimal state a coarse SSE stream
 * requires: message roles (to skip the echoed user prompt), the open text/reasoning parts
 * (to accumulate deltas and finalize their streaming flag), and pending approvals (to
 * preserve their title/command when the human answers). `newId` is injectable so tests get
 * deterministic ids for the id-less items (errors).
 */
export function createOpencodeTranslator(
  mode: AgentMode,
  newId: () => string = randomUUID,
): OpencodeTranslator {
  const roles = new Map<string, string>() // messageID -> role
  const parts = new Map<string, StreamingPart>() // partID -> open assistant/reasoning item
  const approvals = new Map<string, PendingApproval>() // permissionID -> title/command

  function finalize(): AgentEvent[] {
    const events: AgentEvent[] = []
    for (const part of parts.values()) {
      events.push({
        t: 'item',
        item: { kind: part.kind, id: part.itemId, text: part.text, streaming: false },
      })
    }
    parts.clear()
    return events
  }

  function handleMessageUpdated(properties: Record<string, unknown>): TranslateResult {
    const info = asRecord(properties.info)
    const id = info ? asString(info.id) : undefined
    const role = info ? asString(info.role) : undefined
    if (id !== undefined && role !== undefined) roles.set(id, role)
    return { events: [] }
  }

  function handlePartUpdated(properties: Record<string, unknown>): TranslateResult {
    const part = asRecord(properties.part)
    if (!part) return { events: [] }
    const type = asString(part.type)
    if (type === 'text' || type === 'reasoning') return handleTextPart(part, type)
    if (type === 'tool') return handleToolPart(part)
    return { events: [] } // step-start/step-finish/file/etc. carry nothing for the timeline
  }

  function handleTextPart(
    part: Record<string, unknown>,
    type: 'text' | 'reasoning',
  ): TranslateResult {
    const id = asString(part.id)
    const messageId = asString(part.messageID)
    if (id === undefined) return { events: [] }
    // WHY: opencode echoes the user's own prompt back as a text part on the user message.
    // Only assistant-authored parts become timeline items; an unknown role (part before its
    // message.updated) defaults to rendering — the user echo always has its role first.
    if (messageId !== undefined && roles.get(messageId) === 'user') return { events: [] }

    const kind = type === 'reasoning' ? 'reasoning' : 'assistant'
    const text = asString(part.text) ?? ''
    const existing = parts.get(id)
    if (existing) {
      // A later part.updated carries the cumulative text; reconcile so delta drift can't
      // accumulate (item upsert REPLACES text, so this is self-correcting).
      existing.text = text
      return { events: [{ t: 'item', item: { kind, id, text, streaming: true } }] }
    }
    parts.set(id, { itemId: id, kind, text })
    return { events: [{ t: 'item', item: { kind, id, text, streaming: true } }] }
  }

  function handlePartDelta(properties: Record<string, unknown>): TranslateResult {
    const partId = asString(properties.partID)
    const field = asString(properties.field)
    const delta = asString(properties.delta)
    if (partId === undefined || delta === undefined) return { events: [] }
    // Only text-field deltas append; a registered part not yet seen is skipped (its
    // part.updated seeds the cumulative text, so no tokens are lost).
    if (field !== 'text') return { events: [] }
    const part = parts.get(partId)
    if (!part) return { events: [] }
    part.text += delta
    return { events: [{ t: 'item-delta', id: part.itemId, delta }] }
  }

  function handleToolPart(part: Record<string, unknown>): TranslateResult {
    const id = asString(part.id)
    if (id === undefined) return { events: [] }
    const tool = asString(part.tool) ?? 'tool'
    const state = asRecord(part.state)
    // The `todowrite` tool carries the whole todo list in its input; render it as the one
    // upserted plan item (id `plan`) instead of a tool row. `todoread` reads without a list,
    // so it stays a tool. If the list isn't in a recoverable shape we skip (no stray row).
    if (tool === 'todowrite') {
      const steps = planStepsFromOpencodeTodos(state)
      return steps === null
        ? { events: [] }
        : { events: [{ t: 'item', item: { kind: 'plan', id: 'plan', steps } }] }
    }
    const status = toolStatus(state)
    const item: Extract<TimelineItem, { kind: 'tool' }> = {
      kind: 'tool',
      id,
      title: tool,
      status,
    }
    const detail = toolDetail(state)
    if (detail !== undefined) item.detail = detail
    const output = toolOutput(state)
    if (output !== undefined) item.output = output
    return { events: [{ t: 'item', item }] }
  }

  function handlePermissionAsked(properties: Record<string, unknown>): TranslateResult {
    const permissionId = asString(properties.id)
    if (permissionId === undefined) return { events: [] }
    const title = permissionTitle(properties)
    const command = permissionCommand(properties)
    // 'full' auto-allows everything. 'auto-edits' auto-allows ONLY edit/write-shaped asks
    // (the "accept edits" contract) — a bash/network/other permission must still surface a
    // prompt, exactly like 'approve', or auto-edits would silently grant a shell. When the
    // ask carries no usable type discriminator we fall through to a prompt (safer than
    // over-granting). See protocol-opencode.md §6.
    const autoAllow =
      mode === 'full' || (mode === 'auto-edits' && isEditShapedPermission(properties))
    if (!autoAllow) {
      approvals.set(permissionId, command !== undefined ? { title, command } : { title })
      const item: Extract<TimelineItem, { kind: 'approval' }> = {
        kind: 'approval',
        id: permissionId,
        requestId: permissionId,
        title,
        status: 'pending',
      }
      if (command !== undefined) item.command = command
      return { events: [{ t: 'item', item }] }
    }
    // Auto-allow without a prompt (the driver POSTs the reply).
    return { events: [], autoApprovePermissionId: permissionId }
  }

  function handleSessionError(properties: Record<string, unknown>): TranslateResult {
    const message = errorMessage(properties.error)
    return {
      events: [...finalize(), { t: 'item', item: { kind: 'error', id: newId(), message } }],
      done: { ok: false },
    }
  }

  function handleSessionIdle(): TranslateResult {
    return {
      events: [...finalize(), { t: 'status', status: 'idle' }],
      done: { ok: true },
    }
  }

  function handle(raw: OpencodeRawEvent): TranslateResult {
    const properties = raw.properties ?? {}
    switch (raw.type) {
      case 'message.updated':
        return handleMessageUpdated(properties)
      case 'message.part.updated':
        return handlePartUpdated(properties)
      case 'message.part.delta':
        return handlePartDelta(properties)
      case 'permission.asked':
        return handlePermissionAsked(properties)
      case 'session.error':
        return handleSessionError(properties)
      case 'session.idle':
        return handleSessionIdle()
      default:
        return { events: [] }
    }
  }

  function resolveApproval(
    requestId: string,
    decision: 'accept' | 'accept-session' | 'decline',
  ): AgentEvent[] {
    const pending = approvals.get(requestId)
    approvals.delete(requestId)
    const item: Extract<TimelineItem, { kind: 'approval' }> = {
      kind: 'approval',
      id: requestId,
      requestId,
      title: pending?.title ?? 'Permission request',
      status: decision === 'decline' ? 'declined' : 'accepted',
    }
    if (pending?.command !== undefined) item.command = pending.command
    return [{ t: 'item', item }]
  }

  return { handle, finalize, resolveApproval }
}

// --- tool/permission/error field extraction (all tolerant) ------------------------------

/**
 * Read the todo list out of a `todowrite` tool's state (`state.input.todos`) into plan
 * steps. OpenCode's todo status vocabulary is pending/in_progress/completed/cancelled;
 * `in_progress` → `active`, `completed` → `done`, everything else → `pending`. Returns null
 * when the input carries no todo array (the shape is genuinely unavailable — skip cleanly).
 */
export function planStepsFromOpencodeTodos(
  state: Record<string, unknown> | undefined,
): { text: string; status: 'pending' | 'active' | 'done' }[] | null {
  const input = state ? asRecord(state.input) : undefined
  const todos = input?.todos
  if (!Array.isArray(todos)) return null
  const steps: { text: string; status: 'pending' | 'active' | 'done' }[] = []
  for (const todo of todos) {
    const record = asRecord(todo)
    if (!record) continue
    const text = asString(record.content) ?? asString(record.text)
    if (text === undefined) continue
    const raw = asString(record.status)
    const status = raw === 'in_progress' ? 'active' : raw === 'completed' ? 'done' : 'pending'
    steps.push({ text, status })
  }
  return steps
}

function toolStatus(state: Record<string, unknown> | undefined): 'running' | 'ok' | 'error' {
  const status = state ? asString(state.status) : undefined
  if (status === 'completed') return 'ok'
  if (status === 'error') return 'error'
  return 'running' // pending / running / unknown
}

function toolDetail(state: Record<string, unknown> | undefined): string | undefined {
  const input = state ? asRecord(state.input) : undefined
  if (!input) return undefined
  // Prefer the most human field (a bash command, an edited path); else a compact dump.
  const command = asString(input.command) ?? asString(input.filePath) ?? asString(input.path)
  if (command !== undefined) return command
  const keys = Object.keys(input)
  if (keys.length === 0) return undefined
  const dump = JSON.stringify(input)
  return dump.length > 200 ? `${dump.slice(0, 199)}…` : dump
}

function toolOutput(state: Record<string, unknown> | undefined): string | undefined {
  if (!state) return undefined
  // Only reach for an error message when the tool actually carries an error — errorMessage
  // synthesizes a default, which must never masquerade as a running tool's (absent) output.
  const output =
    asString(state.output) ?? (state.error !== undefined ? errorMessage(state.error) : undefined)
  if (output === undefined || output === '') return undefined
  return output.length > TOOL_OUTPUT_CAP ? output.slice(0, TOOL_OUTPUT_CAP) : output
}

// opencode's edit/write-family permission types — the only ones "auto-accept edits" grants
// without a prompt. Everything else (bash, webfetch/network, …) still asks. Kept lowercase
// for a case-insensitive match against the ask's declared type.
const EDIT_PERMISSION_TYPES = new Set(['edit', 'write', 'patch', 'multiedit'])

// The permission's declared TYPE (its discriminator), read only from a structured
// `permission.type`/`permission.name` or a top-level `type`. A bare string `permission` is a
// human title ("Run command"), NOT a type, so it's deliberately not treated as one — an
// undeterminable type yields undefined, which handlePermissionAsked treats as "prompt".
function permissionKind(properties: Record<string, unknown>): string | undefined {
  const record = asRecord(properties.permission)
  const fromRecord = record ? (asString(record.type) ?? asString(record.name)) : undefined
  return fromRecord ?? asString(properties.type)
}

function isEditShapedPermission(properties: Record<string, unknown>): boolean {
  const kind = permissionKind(properties)
  return kind !== undefined && EDIT_PERMISSION_TYPES.has(kind.toLowerCase())
}

function permissionTitle(properties: Record<string, unknown>): string {
  const permission = properties.permission
  const asText = asString(permission)
  if (asText !== undefined) return asText
  const record = asRecord(permission)
  const title =
    (record
      ? (asString(record.title) ?? asString(record.type) ?? asString(record.name))
      : undefined) ?? asString(properties.type)
  return title ?? 'Permission request'
}

function permissionCommand(properties: Record<string, unknown>): string | undefined {
  const metadata = asRecord(properties.metadata)
  const fromMetadata = metadata
    ? (asString(metadata.command) ?? asString(metadata.filePath) ?? asString(metadata.path))
    : undefined
  if (fromMetadata !== undefined) return fromMetadata
  const patterns = properties.patterns
  if (Array.isArray(patterns)) {
    const first = patterns.find((p): p is string => typeof p === 'string')
    if (first !== undefined) return first
  }
  return undefined
}

function errorMessage(error: unknown): string {
  const text = asString(error)
  if (text !== undefined) return text
  const record = asRecord(error)
  if (record) {
    const data = asRecord(record.data)
    const message =
      (data ? asString(data.message) : undefined) ??
      asString(record.message) ??
      asString(record.name)
    if (message !== undefined) return message
  }
  return 'The agent turn failed.'
}

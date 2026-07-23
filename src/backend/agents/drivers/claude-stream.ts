import { join } from 'node:path'
import { z } from 'zod'
import { type AgentEvent, type ModelInfo, TOOL_OUTPUT_CAP } from '../../../shared/agent-protocol'
import { PORCELAIN_PREAMBLE } from '../porcelain-preamble'

/**
 * The Claude driver's PURE half: binary resolution, the static model catalog, the
 * tool-title mapping, and the stateful stream translator that folds `claude`'s
 * newline-delimited stream-json stdout into normalized `AgentEvent`s. All the I/O
 * (spawn, stdin, fs) lives in `claude.ts`; everything here is deterministic given its
 * inputs so it can be unit-tested with captured protocol lines, no real CLI.
 *
 * Wire-protocol reference: `claude` v2.1.207 in `--input-format stream-json
 * --output-format stream-json --include-partial-messages --verbose -p` mode. Each stdout
 * line is one JSON object (`SDKMessage | SDKControl*`). We parse LENIENTLY throughout —
 * the live CLI emits more `system` subtypes and top-level types than any fixed union, so
 * an unknown line must be ignored, never fatal.
 */

// --- binary resolution ------------------------------------------------------

/**
 * Resolve the `claude` binary. The daemon can be launched from Finder with a minimal
 * GUI PATH, so a bare `spawn('claude')` would miss a CLI that a login shell finds. We
 * try, in order: an explicit override, every dir on PATH, then the well-known install
 * locations. The exists-checker is injected so this is unit-testable without touching
 * the filesystem; the same shape will back the Codex/OpenCode drivers.
 */
export interface BinLookup {
  exists(path: string): boolean
  env: NodeJS.ProcessEnv
  home: string
}

export function resolveClaudeBin(lookup: BinLookup): string | null {
  const { exists, env, home } = lookup
  const override = env.PORCELAIN_CLAUDE_BIN
  if (override && override.trim() !== '' && exists(override)) return override
  for (const dir of (env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, 'claude')
    if (exists(candidate)) return candidate
  }
  // Well-known locations a GUI-PATH daemon won't have on PATH.
  for (const candidate of [
    join(home, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]) {
    if (exists(candidate)) return candidate
  }
  return null
}

// --- model catalog ----------------------------------------------------------

/**
 * A static, versioned catalog: the CLI offers no cheap offline model list (the account-
 * aware list only comes back over the control-protocol `initialize` handshake, which needs
 * a live stream-json session — too heavy for a status probe). The `--model` flag accepts
 * each canonical slug (never a date suffix), and the init message echoes the resolved full
 * id, so the slug is the stable id to persist on a thread. Kept in sync with the researched
 * option matrix (scratchpad/protocol-options.md §1): per-model reasoning-effort sets and the
 * 200k/1M context-window toggle.
 *
 * `--effort` accepts low/medium/high/xhigh/max; a model advertises only the subset it
 * supports (so buildClaudeArgs drops an unsupported one). `contextWindows` is present ONLY
 * for models that toggle 200k↔1M via the `[1m]` id suffix — Opus 4.8/4.7 are always 1M
 * (no toggle) and Haiku has neither control.
 */
// The two standard effort sets. xhigh is only on the newest tier (fable-5, opus-4-8/4-7,
// sonnet-5); the rest top out at max without an xhigh rung. Default is `high` everywhere
// except Opus 4.7, which the research pins at `xhigh`.
const EFFORTS_WITH_XHIGH = ['low', 'medium', 'high', 'xhigh', 'max']
const EFFORTS_NO_XHIGH = ['low', 'medium', 'high', 'max']
// The 200k/1M toggle offered by the models that aren't hard-wired to one window.
const CONTEXT_WINDOWS = { values: ['200k', '1m'], default: '200k' }

export const CLAUDE_MODELS: ModelInfo[] = [
  {
    id: 'claude-fable-5',
    label: 'Claude Fable 5',
    provider: 'claude',
    description: 'Highest-taste frontier model',
    efforts: { values: EFFORTS_WITH_XHIGH, default: 'high' },
    contextWindows: CONTEXT_WINDOWS,
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    provider: 'claude',
    description: 'Most capable, for hard tasks',
    efforts: { values: EFFORTS_WITH_XHIGH, default: 'high' },
    // Always 1M — no contextWindows toggle.
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'claude',
    description: 'Previous flagship Opus',
    efforts: { values: EFFORTS_WITH_XHIGH, default: 'xhigh' },
    // Always 1M — no contextWindows toggle.
  },
  {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    provider: 'claude',
    description: 'Older high-capability Opus',
    efforts: { values: EFFORTS_NO_XHIGH, default: 'high' },
    contextWindows: CONTEXT_WINDOWS,
  },
  {
    id: 'claude-opus-4-5',
    label: 'Claude Opus 4.5',
    provider: 'claude',
    description: 'Legacy Opus',
    efforts: { values: EFFORTS_NO_XHIGH, default: 'high' },
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'claude',
    description: 'Balanced everyday coding',
    efforts: { values: EFFORTS_WITH_XHIGH, default: 'high' },
    contextWindows: CONTEXT_WINDOWS,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'claude',
    description: 'Previous Sonnet',
    efforts: { values: EFFORTS_NO_XHIGH, default: 'high' },
    contextWindows: CONTEXT_WINDOWS,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    provider: 'claude',
    description: 'Fastest and cheapest',
    // No reasoning-effort or context-window controls.
  },
]

/** Look up a catalog model by its slug (for buildClaudeArgs' effort/context gating). */
export function findClaudeModel(id: string): ModelInfo | undefined {
  return CLAUDE_MODELS.find((model) => model.id === id)
}

// --- auth probe -------------------------------------------------------------

// `~/.claude.json`'s `oauthAccount` is the cheapest reliable auth signal that never
// triggers a login (unlike `claude auth login`). We parse it loosely — any of these
// keys may be absent on an older/newer CLI — and treat "has an account uuid or email"
// as authenticated.
const claudeAccountSchema = z
  .object({
    oauthAccount: z
      .object({
        emailAddress: z.string().optional(),
        accountUuid: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

export interface ClaudeAuth {
  authenticated: boolean
  account?: string
}

export function readClaudeAuthFromJson(raw: string): ClaudeAuth {
  try {
    const parsed = claudeAccountSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return { authenticated: false }
    const account = parsed.data.oauthAccount
    if (!account || (!account.emailAddress && !account.accountUuid)) return { authenticated: false }
    return account.emailAddress
      ? { authenticated: true, account: account.emailAddress }
      : { authenticated: true }
  } catch {
    return { authenticated: false }
  }
}

// --- tool titles ------------------------------------------------------------

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

/**
 * A human title (+ salient detail) for a tool call. The title is the tool's own name so
 * it reads like the CLI ("Bash", "Edit"); the detail is the one argument a reviewer
 * cares about (the command, the file path, the pattern). MCP tools (`mcp__server__tool`)
 * prettify to title=server / detail=tool so the timeline never dumps the wire name.
 * Unknown non-MCP tools fall through to just their name.
 */
export function titleForTool(
  name: string,
  input: Record<string, unknown>,
): { title: string; detail?: string } {
  switch (name) {
    case 'Bash':
      return { title: 'Bash', detail: asString(input.command) }
    case 'Read':
      return { title: 'Read', detail: asString(input.file_path) }
    case 'Edit':
    case 'MultiEdit':
      return { title: 'Edit', detail: asString(input.file_path) }
    case 'Write':
      return { title: 'Write', detail: asString(input.file_path) }
    case 'NotebookEdit':
      return { title: 'Edit notebook', detail: asString(input.notebook_path) }
    case 'Glob':
      return { title: 'Glob', detail: asString(input.pattern) }
    case 'Grep':
      return { title: 'Grep', detail: asString(input.pattern) }
    case 'WebFetch':
      return { title: 'Fetch', detail: asString(input.url) }
    case 'WebSearch':
      return { title: 'Search', detail: asString(input.query) }
    case 'Task':
      return { title: 'Task', detail: asString(input.description) }
    case 'TodoWrite':
      return { title: 'Update todos' }
    default: {
      // Claude wires MCP tools as `mcp__<server>__<tool>` (double underscore). Split once
      // so a tool name that itself contains `__` still lands in detail intact.
      if (name.startsWith('mcp__')) {
        const rest = name.slice('mcp__'.length)
        const sep = rest.indexOf('__')
        if (sep > 0) {
          const server = rest.slice(0, sep)
          const tool = rest.slice(sep + 2)
          if (server !== '' && tool !== '') {
            // Capitalize the server id for the row title ("porcelain" → "Porcelain").
            const title = server.charAt(0).toUpperCase() + server.slice(1)
            return { title, detail: tool }
          }
        }
      }
      return { title: name }
    }
  }
}

/** Salient string keys we try to recover from a still-streaming tool-input JSON fragment. */
const PEEK_TOOL_KEYS = [
  'command',
  'file_path',
  'path',
  'notebook_path',
  'pattern',
  'url',
  'query',
  'description',
] as const

/**
 * Best-effort fields from a tool's streamed `input_json_delta` buffer. Full `JSON.parse`
 * when the fragment is already valid; otherwise pull completed `"key":"value"` pairs so a
 * running Bash/Read row can show its command/path before the block closes.
 */
export function peekToolFields(json: string): Record<string, unknown> {
  if (json === '') return {}
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // incomplete JSON — fall through to regex peeks of finished string values
  }
  const fields: Record<string, unknown> = {}
  for (const key of PEEK_TOOL_KEYS) {
    // A completed JSON string value: "key":"…escaped…" (closing quote required).
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
    const match = re.exec(json)
    if (!match) continue
    try {
      fields[key] = JSON.parse(`"${match[1]}"`) as string
    } catch {
      fields[key] = match[1]
    }
  }
  return fields
}

// --- plan (TodoWrite) mapping -----------------------------------------------

type PlanStep = { text: string; status: 'pending' | 'active' | 'done' }

/**
 * Translate a `TodoWrite` tool input (`{todos: [{content, status, activeForm}]}`) into the
 * normalized plan steps. `in_progress` → `active`, `completed` → `done`, everything else →
 * `pending`; a todo with no usable text is skipped. Returns null when there's no todo array
 * (so the caller can fall back rather than emit an empty plan).
 */
export function planStepsFromTodos(input: Record<string, unknown>): PlanStep[] | null {
  const todos = input.todos
  if (!Array.isArray(todos)) return null
  const steps: PlanStep[] = []
  for (const todo of todos) {
    if (!todo || typeof todo !== 'object') continue
    const record = todo as Record<string, unknown>
    const text = asString(record.content) ?? asString(record.activeForm)
    if (text === undefined) continue
    const raw = asString(record.status)
    const status: PlanStep['status'] =
      raw === 'in_progress' ? 'active' : raw === 'completed' ? 'done' : 'pending'
    steps.push({ text, status })
  }
  return steps
}

// Flatten a tool_result's `content` (a string, or an array of Anthropic content blocks)
// into the plain text we show in the tool row's expandable output.
function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block
        if (block && typeof block === 'object' && 'text' in block) {
          const text = (block as { text: unknown }).text
          if (typeof text === 'string') return text
        }
        return JSON.stringify(block)
      })
      .join('\n')
  }
  return JSON.stringify(content)
}

// --- stream translation -----------------------------------------------------

/**
 * A signal the translator surfaces for one stdout line. `event`s go straight to the
 * manager's `emit`; `session` carries the resumable id; `done` closes the turn; and
 * `approval-request` hands the driver the control-request data it needs to answer on
 * stdin (the approval timeline item is already emitted as an `event`).
 */
export type StreamSignal =
  | { t: 'event'; event: AgentEvent }
  | { t: 'session'; sessionId: string }
  | { t: 'done'; ok: boolean }
  | {
      t: 'approval-request'
      requestId: string
      toolName: string
      input: Record<string, unknown>
      permissionSuggestions: unknown[]
    }

const typeSchema = z.object({ type: z.string() }).passthrough()

const initSchema = z.object({
  subtype: z.string(),
  session_id: z.string().optional(),
  // The full model id the CLI resolved for this session (e.g. `claude-opus-4-8-20260115`),
  // echoed even when we passed no `--model`. We surface it so a default-model thread can show
  // which model the CLI actually chose. A catalog slug is a prefix of this id (see CLAUDE_MODELS).
  model: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})

const contentBlockSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
})

const streamEventSchema = z.object({
  event: z.object({
    type: z.string(),
    index: z.number().optional(),
    message: z.object({ id: z.string() }).optional(),
    content_block: contentBlockSchema.optional(),
    delta: z
      .object({
        type: z.string(),
        text: z.string().optional(),
        thinking: z.string().optional(),
        partial_json: z.string().optional(),
      })
      .optional(),
  }),
})

const toolResultBlockSchema = z.object({
  type: z.string(),
  tool_use_id: z.string().optional(),
  content: z.unknown().optional(),
  is_error: z.boolean().optional(),
})

const userSchema = z.object({
  message: z.object({
    content: z.union([z.string(), z.array(toolResultBlockSchema)]),
  }),
})

const resultSchema = z.object({
  subtype: z.string(),
  is_error: z.boolean().optional(),
  // The turn's cumulative cost (notional under a subscription plan, real for API-key auth).
  // Present on both success and error result subtypes; we surface it as the status usage's
  // `costUsd` when it's a number.
  total_cost_usd: z.number().optional(),
  // Claude's result usage: `input_tokens` is often just the *new* tokens (the last user
  // message), while `cache_read_input_tokens` / `cache_creation_input_tokens` hold the
  // bulk of the system prompt + tools. We sum them in `mapClaudeResultUsage` so the UI
  // never shows "2 in · $0.50". Extra keys are ignored (passthrough via optional only).
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
      // Nested cache-creation breakdown some CLI versions emit instead of the flat field.
      cache_creation: z
        .object({
          ephemeral_1h_input_tokens: z.number().optional(),
          ephemeral_5m_input_tokens: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
})

/**
 * Map a Claude stream-json `result.usage` (+ optional `total_cost_usd`) onto the normalized
 * status.usage payload. `inputTokens` is the FULL prompt size (new + cache read + cache
 * creation) so metering matches the real context; `cacheReadTokens` is the cached subset
 * for "(Nk cached)" copy. Pure + exported for unit tests.
 */
export function mapClaudeResultUsage(
  usage:
    | {
        input_tokens?: number
        output_tokens?: number
        cache_read_input_tokens?: number
        cache_creation_input_tokens?: number
        cache_creation?: {
          ephemeral_1h_input_tokens?: number
          ephemeral_5m_input_tokens?: number
        }
      }
    | undefined,
  totalCostUsd: number | undefined,
): { inputTokens: number; outputTokens: number; cacheReadTokens?: number; costUsd?: number } {
  const input = usage?.input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  const cacheRead = usage?.cache_read_input_tokens ?? 0
  const nestedCreation =
    (usage?.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
    (usage?.cache_creation?.ephemeral_5m_input_tokens ?? 0)
  const cacheCreation = usage?.cache_creation_input_tokens ?? nestedCreation
  const cached = cacheRead + cacheCreation
  return {
    // Full prompt size — what the human means by "how many tokens did this turn use".
    inputTokens: input + cached,
    outputTokens: output,
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(totalCostUsd !== undefined ? { costUsd: totalCostUsd } : {}),
  }
}

const controlRequestSchema = z.object({
  request_id: z.string(),
  request: z.object({
    subtype: z.string(),
    tool_name: z.string().optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    permission_suggestions: z.array(z.unknown()).optional(),
  }),
})

// One in-flight content block: its normalized kind + id, the streamed text so far (so
// the close can promote the item to its final, non-streaming form), and — for a
// tool_use block — the tool name plus the streamed partial-JSON input.
interface OpenBlock {
  kind: 'assistant' | 'reasoning' | 'tool' | 'plan'
  id: string
  text: string
  name: string
  input: Record<string, unknown>
  inputJson: string
}

/**
 * Translates one turn's stdout. Stateful across lines (it tracks open content blocks and
 * the current message id) but does no I/O, so a test drives it line-by-line. Item ids are
 * derived from the CLI's own ids — a text/thinking block is `<message id>:<block index>`,
 * a tool block is its `toolu_…` id — so the streamed opener, its final promotion, and the
 * later tool-result flip all upsert the SAME item.
 */
export class ClaudeStreamTranslator {
  // Set from the init `capabilities`; the driver prefers a graceful `interrupt` control
  // request over SIGTERM when the CLI advertises it.
  interruptSupported = false

  private currentMessageId: string | null = null
  private readonly open = new Map<number, OpenBlock>()
  // Tool title/detail kept past the block's close so the tool-result `user` message can
  // re-emit the full item (kind `tool` needs a title) with its output attached.
  private readonly toolTitles = new Map<string, { title: string; detail?: string }>()
  // `TodoWrite` tool-use ids: they render as ONE upserted plan item (id `plan`), not a
  // tool row, so their later `tool_result` `user` message is swallowed instead of emitting
  // a stray "Update todos" tool item.
  private readonly planToolIds = new Set<string>()

  /** Parse + translate one stdout line. A blank or malformed line yields no signals. */
  pushLine(line: string): StreamSignal[] {
    const trimmed = line.trim()
    if (trimmed === '') return []
    let raw: unknown
    try {
      raw = JSON.parse(trimmed)
    } catch {
      return [] // a non-JSON line (should never happen on stdout) is ignored, never fatal
    }
    const typed = typeSchema.safeParse(raw)
    if (!typed.success) return []
    switch (typed.data.type) {
      case 'system':
        return this.handleSystem(raw)
      case 'stream_event':
        return this.handleStreamEvent(raw)
      case 'user':
        return this.handleUser(raw)
      case 'result':
        return this.handleResult(raw)
      case 'control_request':
        return this.handleControlRequest(raw)
      default:
        return []
    }
  }

  private handleSystem(raw: unknown): StreamSignal[] {
    const parsed = initSchema.safeParse(raw)
    if (!parsed.success || parsed.data.subtype !== 'init') return []
    if (parsed.data.capabilities?.includes('interrupt_receipt_v1')) this.interruptSupported = true
    const signals: StreamSignal[] = []
    // The init `session_id` is what `--resume` takes on the next turn.
    if (parsed.data.session_id) signals.push({ t: 'session', sessionId: parsed.data.session_id })
    // The init `model` is the CLI's resolved model id — carry it as a `meta` event so the
    // manager records it on the thread (and the roster labels a default-model thread with it).
    if (parsed.data.model !== undefined && parsed.data.model !== '') {
      signals.push({ t: 'event', event: { t: 'meta', resolvedModel: parsed.data.model } })
    }
    return signals
  }

  private handleStreamEvent(raw: unknown): StreamSignal[] {
    const parsed = streamEventSchema.safeParse(raw)
    if (!parsed.success) return []
    const event = parsed.data.event
    switch (event.type) {
      case 'message_start':
        this.currentMessageId = event.message?.id ?? null
        return []
      case 'content_block_start':
        return event.index === undefined || !event.content_block
          ? []
          : this.openBlock(event.index, event.content_block)
      case 'content_block_delta':
        return event.index === undefined || !event.delta
          ? []
          : this.deltaBlock(event.index, event.delta)
      case 'content_block_stop':
        return event.index === undefined ? [] : this.closeBlock(event.index)
      case 'message_stop':
        this.open.clear()
        this.currentMessageId = null
        return []
      default:
        return []
    }
  }

  private blockId(index: number): string {
    return `${this.currentMessageId ?? 'msg'}:${index}`
  }

  private openBlock(index: number, block: z.infer<typeof contentBlockSchema>): StreamSignal[] {
    if (block.type === 'text') {
      const id = this.blockId(index)
      this.open.set(index, { kind: 'assistant', id, text: '', name: '', input: {}, inputJson: '' })
      return [
        {
          t: 'event',
          event: { t: 'item', item: { kind: 'assistant', id, text: '', streaming: true } },
        },
      ]
    }
    if (block.type === 'thinking' || block.type === 'redacted_thinking') {
      // Claude Code often redacts thinking (display omitted / redacted_thinking): the block
      // opens and closes with no thinking_delta. Don't emit an empty "Thought" row — wait for
      // the first real delta (see deltaBlock) and skip the close when still empty.
      const id = this.blockId(index)
      this.open.set(index, { kind: 'reasoning', id, text: '', name: '', input: {}, inputJson: '' })
      return []
    }
    if (block.type === 'tool_use') {
      // Prefer the CLI's own tool id so the result flip targets the same item.
      const id = block.id ?? this.blockId(index)
      const name = block.name ?? 'tool'
      const input = block.input ?? {}
      // TodoWrite is a plan, not a tool: capture its id so the tool_result is swallowed,
      // accumulate its (streamed) input, and emit the plan item on close (see closeBlock).
      if (name === 'TodoWrite') {
        this.planToolIds.add(id)
        this.open.set(index, { kind: 'plan', id, text: '', name, input, inputJson: '' })
        return []
      }
      this.open.set(index, { kind: 'tool', id, text: '', name, input, inputJson: '' })
      const { title, detail } = titleForTool(name, input)
      this.toolTitles.set(id, { title, detail })
      return [
        {
          t: 'event',
          event: {
            t: 'item',
            item: { kind: 'tool', id, title, ...(detail ? { detail } : {}), status: 'running' },
          },
        },
      ]
    }
    return []
  }

  private deltaBlock(
    index: number,
    delta: NonNullable<z.infer<typeof streamEventSchema>['event']['delta']>,
  ): StreamSignal[] {
    const open = this.open.get(index)
    if (!open) return []
    if (delta.type === 'text_delta' && open.kind === 'assistant' && delta.text !== undefined) {
      open.text += delta.text
      return [{ t: 'event', event: { t: 'item-delta', id: open.id, delta: delta.text } }]
    }
    if (
      delta.type === 'thinking_delta' &&
      open.kind === 'reasoning' &&
      delta.thinking !== undefined
    ) {
      // First visible token opens the reasoning item (we suppressed the empty open for
      // redacted blocks); later tokens stream as deltas.
      const wasEmpty = open.text === ''
      open.text += delta.thinking
      if (wasEmpty) {
        return [
          {
            t: 'event',
            event: {
              t: 'item',
              item: { kind: 'reasoning', id: open.id, text: open.text, streaming: true },
            },
          },
        ]
      }
      return [{ t: 'event', event: { t: 'item-delta', id: open.id, delta: delta.thinking } }]
    }
    // Tool/plan args stream as partial JSON fragments; accumulate and — for tools — re-emit
    // the row as soon as a salient field (command/path/…) is complete so Running/timeline
    // show the detail mid-stream, not only when the block closes.
    if (
      delta.type === 'input_json_delta' &&
      (open.kind === 'tool' || open.kind === 'plan') &&
      delta.partial_json !== undefined
    ) {
      open.inputJson += delta.partial_json
      if (open.kind === 'tool') {
        const peeked = peekToolFields(open.inputJson)
        const { title, detail } = titleForTool(open.name, peeked)
        const known = this.toolTitles.get(open.id)
        if (detail !== undefined && detail !== '' && detail !== known?.detail) {
          this.toolTitles.set(open.id, { title, detail })
          return [
            {
              t: 'event',
              event: {
                t: 'item',
                item: {
                  kind: 'tool',
                  id: open.id,
                  title,
                  detail,
                  status: 'running',
                },
              },
            },
          ]
        }
      }
    }
    return []
  }

  private closeBlock(index: number): StreamSignal[] {
    const open = this.open.get(index)
    if (!open) return []
    this.open.delete(index)
    if (open.kind === 'reasoning') {
      // Redacted / omitted thinking never produced a delta — leave no empty Thought row.
      if (open.text === '') return []
      return [
        {
          t: 'event',
          event: {
            t: 'item',
            item: { kind: 'reasoning', id: open.id, text: open.text, streaming: false },
          },
        },
      ]
    }
    if (open.kind === 'assistant') {
      // Promote the streamed item to its final form (streaming:false) with the full text.
      return [
        {
          t: 'event',
          event: {
            t: 'item',
            item: { kind: 'assistant', id: open.id, text: open.text, streaming: false },
          },
        },
      ]
    }
    // The complete input is now known (reassembled from the streamed partial JSON).
    let input = open.input
    if (open.inputJson !== '') {
      try {
        const parsed = JSON.parse(open.inputJson)
        if (parsed && typeof parsed === 'object') input = parsed as Record<string, unknown>
      } catch {
        // partial-JSON reassembly failed — keep the content_block_start input.
      }
    }
    if (open.kind === 'plan') {
      // Upsert the single plan item under the stable id `plan`; a later TodoWrite replaces it.
      const steps = planStepsFromTodos(input)
      if (steps === null) return []
      return [{ t: 'event', event: { t: 'item', item: { kind: 'plan', id: 'plan', steps } } }]
    }
    // Tool block: re-emit with a refined title/detail.
    const { title, detail } = titleForTool(open.name, input)
    this.toolTitles.set(open.id, { title, detail })
    return [
      {
        t: 'event',
        event: {
          t: 'item',
          item: {
            kind: 'tool',
            id: open.id,
            title,
            ...(detail ? { detail } : {}),
            status: 'running',
          },
        },
      },
    ]
  }

  private handleUser(raw: unknown): StreamSignal[] {
    const parsed = userSchema.safeParse(raw)
    if (!parsed.success) return []
    const content = parsed.data.message.content
    if (typeof content === 'string') return []
    const signals: StreamSignal[] = []
    for (const block of content) {
      if (block.type !== 'tool_result' || !block.tool_use_id) continue
      // The TodoWrite result belongs to a plan item, not a tool row — swallow it.
      if (this.planToolIds.has(block.tool_use_id)) continue
      const known = this.toolTitles.get(block.tool_use_id) ?? { title: 'Tool' }
      const output = stringifyToolResult(block.content ?? '').slice(0, TOOL_OUTPUT_CAP)
      signals.push({
        t: 'event',
        event: {
          t: 'item',
          item: {
            kind: 'tool',
            id: block.tool_use_id,
            title: known.title,
            ...(known.detail ? { detail: known.detail } : {}),
            status: block.is_error ? 'error' : 'ok',
            ...(output !== '' ? { output } : {}),
          },
        },
      })
    }
    return signals
  }

  private handleResult(raw: unknown): StreamSignal[] {
    const parsed = resultSchema.safeParse(raw)
    if (!parsed.success) {
      // A result line we couldn't read still ends the turn — never leave it hanging.
      return [{ t: 'done', ok: false }]
    }
    const ok = parsed.data.subtype === 'success' && parsed.data.is_error !== true
    return [
      {
        t: 'event',
        event: {
          t: 'status',
          status: 'idle',
          // mapClaudeResultUsage folds cache_* into inputTokens so the UI's "in" count is
          // the real prompt size (not just the last user message). Cost is only carried
          // when present — absent leaves the thread's totalCostUsd untouched (applyUsage).
          usage: mapClaudeResultUsage(parsed.data.usage, parsed.data.total_cost_usd),
        },
      },
      { t: 'done', ok },
    ]
  }

  private handleControlRequest(raw: unknown): StreamSignal[] {
    const parsed = controlRequestSchema.safeParse(raw)
    if (!parsed.success || parsed.data.request.subtype !== 'can_use_tool') return []
    const { request_id: requestId, request } = parsed.data
    const toolName = request.tool_name ?? 'tool'
    const input = request.input ?? {}
    const { title, detail } = titleForTool(toolName, input)
    return [
      {
        t: 'event',
        event: {
          t: 'item',
          item: {
            kind: 'approval',
            id: `approval:${requestId}`,
            requestId,
            title,
            ...(detail ? { command: detail } : {}),
            status: 'pending',
          },
        },
      },
      {
        t: 'approval-request',
        requestId,
        toolName,
        input,
        permissionSuggestions: request.permission_suggestions ?? [],
      },
    ]
  }
}

// --- outgoing messages ------------------------------------------------------

/**
 * The stdin `user` line for a turn: a text block (always present so an image-only send
 * still has a slot) plus one Anthropic base64 `image` block per attachment. The CLI
 * fills in the session id, so we omit it.
 */
export function buildUserMessage(
  text: string,
  images: { mediaType: string; base64: string }[],
): string {
  const content: unknown[] = [{ type: 'text', text }]
  for (const image of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    })
  }
  return JSON.stringify({ type: 'user', message: { role: 'user', content } })
}

/**
 * The full `claude` argv for one turn. Kept pure (and separate from the driver's I/O shell)
 * so the flag construction is unit-testable. `--model` is pushed ONLY for a non-empty model
 * — an empty string means "the CLI's own default", and passing `--model ''` makes the CLI
 * reject the launch. `--resume` follows the same present-only rule for the session id.
 *
 * Model options apply per the catalog (scratchpad/protocol-options.md §1b/§1c):
 * - `effort` becomes `--effort <v>` only when the chosen model advertises that value (an
 *   unsupported effort is dropped, never sent — the CLI would reject a bad level).
 * - `contextWindow === '1m'` becomes the model-id suffix `[1m]` (`claude-sonnet-5[1m]`),
 *   again only for a model that toggles context windows; an always-1M model (Opus 4.8/4.7)
 *   has no `contextWindows` descriptor, so the option is ignored.
 * - `interaction === 'plan'` sends `--permission-mode plan` INSTEAD of the mode-derived
 *   value. WHY it replaces rather than combines: the CLI has one permission-mode slot,
 *   and plan mode is itself a permission posture (read/explore only, present a plan) —
 *   it supersedes approve/auto-edits/full for as long as the toggle is on; flipping back
 *   to Build restores the thread's own mode on the next turn.
 *
 * `--exclude-dynamic-system-prompt-sections` moves cwd/env/git status out of the system
 * prompt into the first user message so the system-prompt prefix stays cache-stable across
 * our per-turn `claude -p --resume` spawns (each spawn is a cold process; without this the
 * dynamic sections bust the cache every turn and re-bill the full system prompt).
 */
export function buildClaudeArgs(opts: {
  model: string
  mode: 'approve' | 'auto-edits' | 'full'
  interaction?: 'build' | 'plan'
  resumeId?: string
  options?: { effort?: string; contextWindow?: string }
}): string[] {
  const args = [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--include-partial-messages',
    // stream-json output with -p REQUIRES --verbose or the CLI refuses to start.
    '--verbose',
    // Prompt-cache hygiene across per-turn process spawns (see docstring above).
    '--exclude-dynamic-system-prompt-sections',
    // Tell the agent it's running inside Porcelain on EVERY turn (each is a fresh
    // `claude -p --resume` process). A constant string keeps the system-prompt prefix
    // cache-stable, same rationale as --exclude-dynamic-system-prompt-sections above.
    '--append-system-prompt',
    PORCELAIN_PREAMBLE,
  ]
  const catalog = findClaudeModel(opts.model)
  const { effort, contextWindow } = opts.options ?? {}
  if (opts.model !== '') {
    // Append the `[1m]` context suffix only for a toggle-capable model asked for 1M.
    const use1m = contextWindow === '1m' && catalog?.contextWindows?.values.includes('1m') === true
    args.push('--model', use1m ? `${opts.model}[1m]` : opts.model)
  }
  args.push(
    '--permission-mode',
    opts.interaction === 'plan' ? 'plan' : permissionModeForMode(opts.mode),
  )
  if (effort !== undefined && effort !== '' && catalog?.efforts?.values.includes(effort) === true) {
    args.push('--effort', effort)
  }
  if (opts.resumeId !== undefined && opts.resumeId !== '') args.push('--resume', opts.resumeId)
  return args
}

/** The `--permission-mode` value for each of our three postures. */
export function permissionModeForMode(mode: 'approve' | 'auto-edits' | 'full'): string {
  switch (mode) {
    case 'approve':
      return 'default'
    case 'auto-edits':
      return 'acceptEdits'
    case 'full':
      return 'bypassPermissions'
  }
}

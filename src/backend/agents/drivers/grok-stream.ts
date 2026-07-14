import { join } from 'node:path'
import { type AgentEvent, type ModelInfo, TOOL_OUTPUT_CAP } from '../../../shared/agent-protocol'

/**
 * The Grok driver's PURE half: binary resolution, the static model catalog, auth
 * parse, arg building, and the stateful stream translator that folds `grok`'s
 * newline-delimited `--output-format streaming-json` stdout into normalized
 * `AgentEvent`s. All the I/O (spawn, fs) lives in `grok.ts`.
 *
 * Wire-protocol reference: Grok Build CLI headless mode (docs/user-guide/14-headless-mode.md).
 * Each stdout line is one JSON object with a `type` field. Documented events:
 *   text | thought | end | error
 * (plus non-exhaustive extras like max_turns_reached — unknown lines are ignored).
 * Tool calls run inside the CLI but are NOT projected into streaming-json, so the
 * timeline only shows reasoning + assistant text for this provider.
 */

// --- binary resolution ------------------------------------------------------

export interface BinLookup {
  exists(path: string): boolean
  env: NodeJS.ProcessEnv
  home: string
}

export function resolveGrokBin(lookup: BinLookup): string | null {
  const { exists, env, home } = lookup
  const override = env.PORCELAIN_GROK_BIN
  if (override && override.trim() !== '' && exists(override)) return override
  for (const dir of (env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, 'grok')
    if (exists(candidate)) return candidate
  }
  // Well-known locations a GUI-PATH daemon won't have on PATH. The install drops
  // a shim at ~/.local/bin and a managed binary under ~/.grok/bin.
  for (const candidate of [
    join(home, '.local', 'bin', 'grok'),
    join(home, '.grok', 'bin', 'grok'),
    '/opt/homebrew/bin/grok',
    '/usr/local/bin/grok',
  ]) {
    if (exists(candidate)) return candidate
  }
  return null
}

// --- model catalog ----------------------------------------------------------

// Effort rungs the CLI accepts via `--reasoning-effort` / `--effort` (canonical list from
// the headless docs). Grok models advertise the full set; the default is `high`.
const GROK_EFFORTS = {
  values: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  default: 'high',
}

/**
 * Static catalog: `grok models` is interactive/network and too heavy for a status probe.
 * Kept in sync with the install's advertised models (0.2.x: grok-4.5 default + the
 * faster composer). The id is what `--model` accepts and what we persist on the thread.
 */
export const GROK_MODELS: ModelInfo[] = [
  {
    id: 'grok-4.5',
    label: 'Grok 4.5',
    provider: 'grok',
    description: 'Default coding model',
    efforts: GROK_EFFORTS,
  },
  {
    id: 'grok-composer-2.5-fast',
    label: 'Grok Composer 2.5 Fast',
    provider: 'grok',
    description: 'Faster, cheaper composer',
    efforts: GROK_EFFORTS,
  },
]

export function findGrokModel(id: string): ModelInfo | undefined {
  return GROK_MODELS.find((m) => m.id === id)
}

// --- auth -------------------------------------------------------------------

/**
 * Auth signal from `~/.grok/auth.json` (OAuth/session tokens keyed by issuer) and/or
 * `XAI_API_KEY` in the env. Never returns or logs token material — only a boolean and an
 * optional human label when one is present on the file.
 */
export function readGrokAuth(opts: { authJson: string | null; env: NodeJS.ProcessEnv }): {
  authenticated: boolean
  account?: string
} {
  if (opts.env.XAI_API_KEY && opts.env.XAI_API_KEY.trim() !== '') {
    return { authenticated: true, account: 'API key' }
  }
  if (opts.authJson === null || opts.authJson.trim() === '') {
    return { authenticated: false }
  }
  try {
    const parsed: unknown = JSON.parse(opts.authJson)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed as Record<string, unknown>)
      if (keys.length > 0) {
        // No stable email field on the auth file (tokens only). Surface "grok.com" so the
        // settings row reads as signed-in without inventing an account id.
        return { authenticated: true, account: 'grok.com' }
      }
    }
  } catch {
    // corrupt file → unauthenticated
  }
  return { authenticated: false }
}

// --- args -------------------------------------------------------------------

/** Map Porcelain's three permission postures onto Grok's `--permission-mode` values. */
export function permissionModeForMode(mode: 'approve' | 'auto-edits' | 'full'): string {
  switch (mode) {
    case 'approve':
      // Headless has no interactive approval channel (streaming-json is one-way), so
      // "approve" can't surface a Porcelain approval card. `default` still applies the
      // CLI's own deny-by-default posture for tools not pre-allowed.
      return 'default'
    case 'auto-edits':
      return 'acceptEdits'
    case 'full':
      return 'bypassPermissions'
  }
}

/**
 * Build the argv for one headless turn. `interaction === 'plan'` replaces the mode-derived
 * permission mode (same rationale as Claude — one permission-mode slot, plan is itself a
 * posture). The prompt is NOT on argv here when using `--prompt-file`/`-p` from the I/O
 * shell — this helper builds the shared flags; `buildGrokArgs` includes `-p` + prompt for
 * the common path.
 */
export function buildGrokArgs(opts: {
  prompt: string
  model: string
  mode: 'approve' | 'auto-edits' | 'full'
  interaction?: 'build' | 'plan'
  resumeId?: string
  options?: { effort?: string }
}): string[] {
  const args = ['-p', opts.prompt, '--output-format', 'streaming-json']
  if (opts.model !== '') args.push('--model', opts.model)
  args.push(
    '--permission-mode',
    opts.interaction === 'plan' ? 'plan' : permissionModeForMode(opts.mode),
  )
  const catalog = findGrokModel(opts.model)
  const effort = opts.options?.effort
  if (effort !== undefined && effort !== '' && catalog?.efforts?.values.includes(effort) === true) {
    args.push('--reasoning-effort', effort)
  }
  if (opts.resumeId !== undefined && opts.resumeId !== '') {
    args.push('--resume', opts.resumeId)
  }
  // Keep headless stdout clean of update banners (they go to stderr anyway, but be explicit).
  args.push('--no-auto-update')
  return args
}

// --- stream translator ------------------------------------------------------

export type StreamSignal =
  | { t: 'event'; event: AgentEvent }
  | { t: 'session'; sessionId: string }
  | { t: 'done'; ok: boolean }

const ASSISTANT_ID = 'grok-assistant'
const REASONING_ID = 'grok-reasoning'

/**
 * Stateful fold of streaming-json lines into AgentEvents. One instance per turn.
 * Text/thought chunks accumulate into a single streaming assistant/reasoning item
 * (re-emitted with the growing text so the reducer upserts); `end` finalizes them,
 * reports usage, and signals done.
 */
export class GrokStreamTranslator {
  private assistantText = ''
  private reasoningText = ''
  private assistantOpen = false
  private reasoningOpen = false
  private finished = false

  pushLine(line: string): StreamSignal[] {
    const trimmed = line.trim()
    if (trimmed === '' || this.finished) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return []
    }
    if (!parsed || typeof parsed !== 'object') return []
    const obj = parsed as Record<string, unknown>
    const type = obj.type
    if (typeof type !== 'string') return []

    switch (type) {
      case 'text':
        return this.onText(obj)
      case 'thought':
        return this.onThought(obj)
      case 'end':
        return this.onEnd(obj)
      case 'error':
        return this.onError(obj)
      default:
        return []
    }
  }

  private onText(obj: Record<string, unknown>): StreamSignal[] {
    const data = typeof obj.data === 'string' ? obj.data : ''
    if (data === '') return []
    // A thought block that's still open closes when the first text arrives (mirrors
    // "reasoning then answer" in the UI).
    const out: StreamSignal[] = []
    if (this.reasoningOpen) {
      out.push(...this.closeReasoning())
    }
    this.assistantText += data
    this.assistantOpen = true
    out.push({
      t: 'event',
      event: {
        t: 'item',
        item: {
          kind: 'assistant',
          id: ASSISTANT_ID,
          text: this.assistantText,
          streaming: true,
        },
      },
    })
    return out
  }

  private onThought(obj: Record<string, unknown>): StreamSignal[] {
    const data = typeof obj.data === 'string' ? obj.data : ''
    if (data === '') return []
    this.reasoningText += data
    this.reasoningOpen = true
    // Cap the reasoning body the same way tool output is capped so a long chain of
    // thought can't bloat the thread file / attach snapshot.
    const text =
      this.reasoningText.length > TOOL_OUTPUT_CAP
        ? this.reasoningText.slice(0, TOOL_OUTPUT_CAP)
        : this.reasoningText
    return [
      {
        t: 'event',
        event: {
          t: 'item',
          item: { kind: 'reasoning', id: REASONING_ID, text, streaming: true },
        },
      },
    ]
  }

  private onEnd(obj: Record<string, unknown>): StreamSignal[] {
    this.finished = true
    const out: StreamSignal[] = []
    if (this.reasoningOpen) out.push(...this.closeReasoning())
    if (this.assistantOpen) out.push(...this.closeAssistant())

    const sessionId = typeof obj.sessionId === 'string' ? obj.sessionId : undefined
    if (sessionId !== undefined && sessionId !== '') {
      out.push({ t: 'session', sessionId })
    }

    const usage = mapGrokUsage(obj.usage)
    if (usage !== null) {
      out.push({ t: 'event', event: { t: 'status', status: 'idle', usage } })
    }

    const modelUsage = obj.modelUsage
    if (modelUsage && typeof modelUsage === 'object') {
      const keys = Object.keys(modelUsage as Record<string, unknown>)
      if (keys.length === 1) {
        out.push({ t: 'event', event: { t: 'meta', resolvedModel: keys[0] } })
      }
    }

    const stop = typeof obj.stopReason === 'string' ? obj.stopReason : ''
    const ok = stop === '' || stop === 'EndTurn' || stop === 'end_turn'
    out.push({ t: 'done', ok })
    return out
  }

  private onError(obj: Record<string, unknown>): StreamSignal[] {
    this.finished = true
    const message =
      typeof obj.message === 'string' && obj.message !== '' ? obj.message : 'Grok reported an error'
    return [
      {
        t: 'event',
        event: { t: 'item', item: { kind: 'error', id: 'grok-error', message } },
      },
      { t: 'done', ok: false },
    ]
  }

  private closeAssistant(): StreamSignal[] {
    this.assistantOpen = false
    return [
      {
        t: 'event',
        event: {
          t: 'item',
          item: {
            kind: 'assistant',
            id: ASSISTANT_ID,
            text: this.assistantText,
            streaming: false,
          },
        },
      },
    ]
  }

  private closeReasoning(): StreamSignal[] {
    this.reasoningOpen = false
    const text =
      this.reasoningText.length > TOOL_OUTPUT_CAP
        ? this.reasoningText.slice(0, TOOL_OUTPUT_CAP)
        : this.reasoningText
    return [
      {
        t: 'event',
        event: {
          t: 'item',
          item: { kind: 'reasoning', id: REASONING_ID, text, streaming: false },
        },
      },
    ]
  }
}

/** Map Grok's end-event `usage` object onto a status.usage payload. */
export function mapGrokUsage(
  raw: unknown,
): { inputTokens: number; outputTokens: number; costUsd?: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as Record<string, unknown>
  const input = num(u.input_tokens)
  const output = num(u.output_tokens)
  if (input === null && output === null) return null
  const usage: { inputTokens: number; outputTokens: number; costUsd?: number } = {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
  }
  // Prefer total_cost_usd when present (API-key traffic); subscription often omits it.
  const cost = num(u.total_cost_usd)
  if (cost !== null) usage.costUsd = cost
  return usage
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

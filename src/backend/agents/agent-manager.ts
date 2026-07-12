import { randomUUID } from 'node:crypto'
import {
  type AgentEvent,
  type AgentImage,
  type AgentInteraction,
  type AgentMode,
  type AgentProvider,
  type AgentStatus,
  type ApprovalDecision,
  agentProviderSchema,
  applyAgentEvent,
  type ProviderLimits,
  type ProviderStatus,
  type ThreadInfo,
  type ThreadOptions,
  type TimelineItem,
} from '../../shared/agent-protocol'
import { emitAppEvent } from '../app-events'
import type { TerminalSender } from '../terminal-manager'
import { drivers as defaultDrivers } from './drivers'
import {
  deleteThreadFile,
  listThreadFiles,
  readThread,
  type StoredThread,
  writeThread,
} from './thread-store'
import type { AgentCommand, DriverRegistry, TurnHandle } from './types'

/**
 * The thread session layer — the Agent tab's analogue of `terminal-manager.ts`: an
 * in-memory Map of threads, each with a SET of attached WS senders, live turn events
 * fanned out to all of them, and a snapshot replayed on attach. Unlike PTYs, threads
 * PERSIST to disk (`thread-store.ts`) and survive a daemon restart — the map is
 * hydrated lazily from disk on first use. The daemon is the sole owner; a dropped
 * socket only DETACHES a sender (the thread and any running turn live on).
 *
 * A driver runs the actual CLI turn; this module owns everything around it: the user
 * item, one-active-turn-per-thread guard, reducing events into the persisted timeline,
 * debounced writes, fan-out, and the `agent-threads` roster broadcast. It never imports
 * the transport (session.ts adapts `send` into WS messages, exactly like terminals).
 */

// A session IS this structural sender (send + isDestroyed); reuse the terminal one
// rather than declare a second identical shape.
export type AgentSender = TerminalSender

interface Thread {
  // `meta` is the full ThreadInfo (status included) the roster renders.
  meta: ThreadInfo
  // Driver-private resume state, persisted opaque and passed back on the next turn.
  sessionState: unknown
  items: TimelineItem[]
  attached: Set<AgentSender>
  // The active turn's handle, or null when idle — the one-turn-per-thread guard.
  turn: TurnHandle | null
  // Identity of the active turn. A driver may legitimately fire a final emit/onDone after
  // its process exits — the Claude driver does on abort's exit path. If that lands after
  // abortTurn cleared `turn` and a NEW turn started, the stale callback would corrupt the
  // live turn (onDone flips it idle mid-work, emit injects into the new timeline). Each
  // turn stamps a fresh token here; its callbacks no-op unless this still matches, and
  // abortTurn nulls it so a late callback from the killed turn is inert.
  turnToken: symbol | null
  // Trailing debounce timer for persistence, and the serialized write chain so two
  // quick writes to the same file never overlap (the tmp name is shared).
  persistTimer: ReturnType<typeof setTimeout> | null
  persistChain: Promise<void>
  // The cumulative token + cost totals captured when the current turn started, so a driver's
  // per-turn `status.usage` (which reports THIS turn's counts, possibly several times as
  // it streams) folds into a running total without double-counting: total = base + turn.
  turnUsageBase: { input: number; output: number; cost: number }
  // Set on the first user message (whose title came from deriveTitle); consumed on the
  // first successful onDone to fire the one-shot LLM auto-title. Runtime-only — a restart
  // just keeps the derived title, which is fine.
  pendingAutoTitle: boolean
  // The ONE message queued behind the running turn (last-write-wins), auto-run when the turn
  // ends (naturally OR via abort — "stop this, do the next thing"). The FULL images live here,
  // daemon-only, never reduced and never persisted (mirrors the timeline, which only ever
  // persists thumbnails); `meta.queued` carries the lightweight {text, imageCount} to disk +
  // the roster. A hard daemon restart therefore keeps the queued text/chip but drops the full
  // images (rare, documented) — and since a hydrated thread is idle, a restored queue just
  // shows a chip until the user cancels it or sends again (both clear it).
  queued: QueuedMessage | null
}

// The full queued message the manager holds in memory (full images included) — distinct from
// the persisted/roster `QueuedMessageInfo`, which is text + count only.
interface QueuedMessage {
  text: string
  images: AgentImage[]
  thumbnails: AgentImage[]
}

const PERSIST_DEBOUNCE_MS = 500
const TITLE_MAX = 60

// A no-op handle claimed synchronously the instant a send passes the one-turn guard, so a
// concurrent send hits the already-working branch — the real driver handle only lands
// several awaits later (see sendMessage). abort/respondApproval are no-ops: there is
// nothing to interrupt yet, and an abort during this window is handled by the token check.
const PENDING_TURN: TurnHandle = { abort() {}, respondApproval() {} }

const threads = new Map<string, Thread>()

// The driver registry, overridable for tests (setDrivers). Defaults to the real
// provider→driver map; api.ts probes statuses through `providerStatuses` below so the
// override reaches every caller.
let drivers: DriverRegistry = defaultDrivers

/**
 * Lazy hydration: the first call that needs the map loads every thread file from disk
 * once (guarded by a shared promise so concurrent callers await the same load). A
 * corrupt/absent file is skipped (readThread returns null).
 */
let hydration: Promise<void> | null = null
function ensureHydrated(): Promise<void> {
  if (hydration === null) {
    hydration = (async () => {
      for (const id of await listThreadFiles()) {
        const stored = await readThread(id)
        if (stored) threads.set(id, toThread(stored))
      }
    })()
  }
  return hydration
}

function toThread(stored: StoredThread): Thread {
  return {
    // `queued` persists top-level on the file (next to items), NOT inside the stored meta —
    // restore it onto the roster meta here so the composer's chip survives a restart.
    meta: { ...stored.meta, status: 'idle', ...(stored.queued ? { queued: stored.queued } : {}) },
    sessionState: stored.sessionState,
    items: stored.items,
    attached: new Set(),
    turn: null,
    turnToken: null,
    persistTimer: null,
    persistChain: Promise.resolve(),
    turnUsageBase: { input: 0, output: 0, cost: 0 },
    pendingAutoTitle: false,
    // Restore the queued message from disk, but with empty images — the full payloads aren't
    // persisted (see the Thread comment).
    queued:
      stored.queued !== undefined ? { text: stored.queued.text, images: [], thumbnails: [] } : null,
  }
}

function toStored(thread: Thread): StoredThread {
  // Drop the runtime `status` — a hydrated thread is always idle (see thread-store).
  const {
    id,
    repoPath,
    title,
    provider,
    model,
    mode,
    interaction,
    options,
    usage,
    turnStartedAt,
    lastTurnFailed,
    queued,
    createdAt,
    updatedAt,
  } = thread.meta
  return {
    meta: {
      id,
      repoPath,
      title,
      provider,
      model,
      mode,
      ...(interaction !== undefined ? { interaction } : {}),
      ...(options !== undefined ? { options } : {}),
      ...(usage !== undefined ? { usage } : {}),
      ...(turnStartedAt !== undefined ? { turnStartedAt } : {}),
      ...(lastTurnFailed !== undefined ? { lastTurnFailed } : {}),
      createdAt,
      updatedAt,
    },
    sessionState: thread.sessionState,
    items: thread.items,
    ...(queued !== undefined ? { queued } : {}),
  }
}

function broadcastRoster(): void {
  emitAppEvent('agent-threads')
}

/** Fan a `send` out to every still-alive attached sender, dropping destroyed ones. */
function fanOut(thread: Thread, channel: string, ...args: unknown[]): void {
  for (const sender of thread.attached) {
    if (sender.isDestroyed()) thread.attached.delete(sender)
    else sender.send(channel, ...args)
  }
}

// Serialized write of the thread's current state; also cancels a pending debounce so a
// flush and its scheduled write don't both fire. Best-effort — a failed write retries
// on the next event.
function persistNow(thread: Thread): Promise<void> {
  if (thread.persistTimer !== null) {
    clearTimeout(thread.persistTimer)
    thread.persistTimer = null
  }
  thread.persistChain = thread.persistChain
    .catch(() => {})
    .then(() => writeThread(thread.meta.id, toStored(thread)))
  return thread.persistChain
}

// Trailing debounce: coalesce a burst of streaming deltas into one write ~500ms after
// the last event. A flush (persistNow) clears this.
function schedulePersist(thread: Thread): void {
  if (thread.persistTimer !== null) return
  thread.persistTimer = setTimeout(() => {
    thread.persistTimer = null
    persistNow(thread).catch(() => {})
  }, PERSIST_DEBOUNCE_MS)
}

function setStatus(thread: Thread, status: AgentStatus): void {
  if (thread.meta.status === status) return
  thread.meta.status = status
  // Stamp the turn's start when it begins so the viewer's "Working for Ns" counts from the
  // real start (not from when a client opened the thread). Left as-is on idle — it's only read
  // while working, so a stale idle value is harmless.
  if (status === 'working') thread.meta.turnStartedAt = Date.now()
  thread.meta.updatedAt = Date.now()
  broadcastRoster()
  // The manager is the authoritative source of working/idle, so a real flip is fanned
  // straight to attached clients as a `status` event (the SAME reducer runs client-side).
  // This is run-state, NOT timeline data — it skips applyAgentEvent/persistence, mirroring
  // onEmit's fan line. Drivers' own status events are still relayed by onEmit (usage info).
  fanOut(thread, 'agent:event', thread.meta.id, { t: 'status', status })
}

// A driver `meta` event moved thread metadata (an auto-title from the CLI, a model
// swap); mirror it onto the roster so the list stays in sync with the live view.
function applyMeta(thread: Thread, event: Extract<AgentEvent, { t: 'meta' }>): void {
  let changed = false
  if (event.title !== undefined && event.title !== thread.meta.title) {
    thread.meta.title = event.title
    changed = true
  }
  if (event.model !== undefined && event.model !== thread.meta.model) {
    thread.meta.model = event.model
    changed = true
  }
  if (event.provider !== undefined && event.provider !== thread.meta.provider) {
    thread.meta.provider = event.provider
    changed = true
  }
  if (changed) {
    thread.meta.updatedAt = Date.now()
    broadcastRoster()
  }
}

// The driver's `emit` for a turn: reduce into the persisted timeline, debounce-persist,
// and fan the raw event out to attached clients (which run the SAME reducer). `status`
// stays manager-owned (send/onDone); a driver `status` event is still relayed to
// clients (usage), just not trusted to flip idle/working here.
function onEmit(thread: Thread, event: AgentEvent): void {
  if (event.t === 'meta') applyMeta(thread, event)
  if (event.t === 'status' && event.usage) applyUsage(thread, event.usage)
  thread.items = applyAgentEvent(thread.items, event)
  schedulePersist(thread)
  fanOut(thread, 'agent:event', thread.meta.id, event)
}

// Fold a driver's per-turn token report into the thread's accumulated usage. The report
// carries THIS turn's running counts (a driver may re-report as it streams), so the turn
// values are taken as-is and the totals are recomputed off the per-turn baseline — never
// added incrementally — so repeated reports for one turn don't double-count. Broadcasts
// the roster (but doesn't bump updatedAt, to avoid reshuffling the list mid-stream).
function applyUsage(
  thread: Thread,
  usage: { inputTokens: number; outputTokens: number; costUsd?: number },
): void {
  // Cost accumulates by the SAME baseline discipline as tokens: total = base + this turn's
  // reported cost. A report without `costUsd` (Codex, or a mid-turn token-only report) keeps
  // the prior accumulated total rather than dropping it.
  const totalCostUsd =
    usage.costUsd !== undefined
      ? thread.turnUsageBase.cost + usage.costUsd
      : thread.meta.usage?.totalCostUsd
  thread.meta.usage = {
    turnInput: usage.inputTokens,
    turnOutput: usage.outputTokens,
    totalInput: thread.turnUsageBase.input + usage.inputTokens,
    totalOutput: thread.turnUsageBase.output + usage.outputTokens,
    ...(totalCostUsd !== undefined ? { totalCostUsd } : {}),
  }
  broadcastRoster()
}

function onDone(thread: Thread, ok: boolean): void {
  thread.turn = null
  // Record whether this turn failed so the roster can flag it; a successful turn clears the
  // flag. The NEXT turn (including a drained queued message below) clears it on start.
  thread.meta.lastTurnFailed = ok ? undefined : true
  setStatus(thread, 'idle')
  persistNow(thread).catch(() => {})
  // After the FIRST turn succeeds, upgrade the derived title to an LLM-generated one (if
  // the driver offers the hook). Fire-and-forget with its own error/timeout handling — it
  // must never block the turn from finishing, and a failure just keeps the derived title.
  if (ok && thread.pendingAutoTitle) {
    thread.pendingAutoTitle = false
    maybeAutoTitle(thread).catch(() => {})
  }
  // Auto-run a queued message REGARDLESS of ok. Rationale: the user queued "do this next",
  // so we honor it even after a failed turn — the `lastTurnFailed` flag still surfaced on the
  // roster before the new turn cleared it, so they can course-correct, but we don't silently
  // drop their intent. (The simplest defensible policy; documented in the feature.)
  // Fire-and-forget here: onDone is a sync driver callback, and a spawn failure must not
  // throw into it (startTurn persists + broadcasts on its own).
  drainQueue(thread).catch(() => {})
}

/**
 * If a message is queued, dequeue it and start it as the next turn. Called when a turn ends
 * (naturally, from onDone — fire-and-forget) or via abort (which awaits it, so an abort
 * resolves with the queued turn already claimed).
 */
async function drainQueue(thread: Thread): Promise<void> {
  const queued = thread.queued
  if (!queued) return
  thread.queued = null
  thread.meta.queued = undefined
  await startTurn(thread, queued)
}

function truncateTitle(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title
}

/** First line of the message, trimmed + truncated — the fallback title (no LLM). */
function deriveTitle(text: string): string {
  const line = text.trim().split('\n')[0]?.trim() ?? ''
  if (line === '') return 'New thread'
  return truncateTitle(line)
}

/**
 * One-shot LLM auto-title after a thread's first successful turn. Asks the driver (if it
 * exposes `generateTitle`) for a short title off the thread's first user message; a
 * non-empty result (trimmed + capped at TITLE_MAX) replaces the derived title, persists,
 * and broadcasts both the roster and a `meta` event to attached clients. Any failure is
 * swallowed by the caller's `.catch` — the derived title stays.
 */
async function maybeAutoTitle(thread: Thread): Promise<void> {
  const driver = drivers[thread.meta.provider]
  if (!driver.generateTitle) return
  const first = thread.items.find((item) => item.kind === 'user')
  const text = first?.kind === 'user' ? first.text : ''
  if (text.trim() === '') return
  const generated = await driver.generateTitle({ repoPath: thread.meta.repoPath, text })
  if (generated === null) return
  const title = truncateTitle(generated.trim())
  if (title === '') return
  // The thread may have been deleted (or replaced) while the LLM ran — bail if so.
  if (threads.get(thread.meta.id) !== thread) return
  thread.meta.title = title
  thread.meta.updatedAt = Date.now()
  persistNow(thread).catch(() => {})
  broadcastRoster()
  fanOut(thread, 'agent:event', thread.meta.id, { t: 'meta', title })
}

export interface CreateThreadOptions {
  repoPath: string
  provider: AgentProvider
  model: string
  mode: AgentMode
  // The model's effort/context-window options, when the caller already knows them (a
  // last-used selection carries them). Absent = an untouched thread with no options,
  // exactly like a thread created before this field existed.
  options?: ThreadOptions
}

export async function createThread(opts: CreateThreadOptions): Promise<ThreadInfo> {
  await ensureHydrated()
  const now = Date.now()
  const meta: ThreadInfo = {
    id: randomUUID(),
    repoPath: opts.repoPath,
    title: 'New thread',
    provider: opts.provider,
    model: opts.model,
    mode: opts.mode,
    ...(opts.options !== undefined ? { options: opts.options } : {}),
    status: 'idle',
    createdAt: now,
    updatedAt: now,
  }
  const thread: Thread = {
    meta,
    sessionState: undefined,
    items: [],
    attached: new Set(),
    turn: null,
    turnToken: null,
    persistTimer: null,
    persistChain: Promise.resolve(),
    turnUsageBase: { input: 0, output: 0, cost: 0 },
    pendingAutoTitle: false,
    queued: null,
  }
  threads.set(meta.id, thread)
  await persistNow(thread)
  broadcastRoster()
  return meta
}

/** The roster for one repo, newest activity first. */
export async function listThreads(repoPath: string): Promise<ThreadInfo[]> {
  await ensureHydrated()
  return [...threads.values()]
    .filter((thread) => thread.meta.repoPath === repoPath)
    .map((thread) => thread.meta)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function renameThread(id: string, title: string): Promise<void> {
  await ensureHydrated()
  const trimmed = title.trim()
  if (trimmed === '') return
  const thread = threads.get(id)
  if (!thread) return
  thread.meta.title = trimmed
  thread.meta.updatedAt = Date.now()
  await persistNow(thread)
  broadcastRoster()
}

export async function updateThread(
  id: string,
  fields: {
    model?: string
    mode?: AgentMode
    provider?: AgentProvider
    interaction?: AgentInteraction
    options?: ThreadOptions
  },
): Promise<ThreadInfo | undefined> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread) return undefined
  if (fields.model !== undefined) thread.meta.model = fields.model
  if (fields.mode !== undefined) thread.meta.mode = fields.mode
  // A model picked from another provider carries its provider with it — the thread's
  // provider must follow the model, or the next turn spawns the wrong CLI.
  if (fields.provider !== undefined) thread.meta.provider = fields.provider
  if (fields.interaction !== undefined) thread.meta.interaction = fields.interaction
  // The options object is replaced wholesale (the renderer sends the full effort +
  // contextWindow it wants), so a cleared control drops out of the stored meta.
  if (fields.options !== undefined) thread.meta.options = fields.options
  thread.meta.updatedAt = Date.now()
  await persistNow(thread)
  broadcastRoster()
  // Return the merged meta so the procedure layer can record the last-used selection
  // (provider may have followed the model here) without re-reading the roster.
  return thread.meta
}

export async function deleteThread(id: string): Promise<void> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread) return
  // Ordering guards against a resurrection race: invalidate the turn token (so a late
  // driver callback can't re-schedule a write), abort the running turn, cancel any pending
  // debounce, and drain the in-flight persist chain — THEN remove from the map and delete
  // the file last. Otherwise a debounced/in-flight write could recreate the file we deleted.
  thread.turnToken = null
  thread.turn?.abort()
  if (thread.persistTimer !== null) {
    clearTimeout(thread.persistTimer)
    thread.persistTimer = null
  }
  await thread.persistChain.catch(() => {})
  threads.delete(id)
  await deleteThreadFile(id)
  broadcastRoster()
}

export interface AttachResult {
  found: boolean
  items: TimelineItem[]
  status: AgentStatus
}

/** Attach a sender to a thread and return its snapshot; found=false for an unknown id. */
export async function attachThread(id: string, sender: AgentSender): Promise<AttachResult> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread) return { found: false, items: [], status: 'idle' }
  thread.attached.add(sender)
  return { found: true, items: thread.items, status: thread.meta.status }
}

/** Stop streaming ONE thread to `sender` (the thread lives on). */
export function detachThread(id: string, sender: AgentSender): void {
  threads.get(id)?.attached.delete(sender)
}

/** Remove `sender` from every thread — called when its socket closes. */
export function detachAgentSender(sender: AgentSender): void {
  for (const thread of threads.values()) thread.attached.delete(sender)
}

export interface SendMessageInput {
  text: string
  images?: AgentImage[]
  // Renderer-downscaled previews of `images`, persisted in the user timeline item (the full
  // `images` go to the CLI live and are never stored). See agent-protocol's `user` item.
  thumbnails?: AgentImage[]
}

/**
 * Send a message to a thread. If the thread is idle, this starts a turn immediately. If a
 * turn is already running, the message is QUEUED (one slot, last-write-wins) to auto-run when
 * the turn ends — a second mid-turn send REPLACES the queued one. The full images ride the
 * in-memory queue; only {text, imageCount} persist + reach the roster (the composer chip).
 */
export async function sendMessage(id: string, input: SendMessageInput): Promise<void> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread) return

  if (thread.turn !== null) {
    // Queue behind the running turn (replacing any prior queued message — last wins).
    const imageCount = input.images?.length ?? 0
    thread.queued = {
      text: input.text,
      images: input.images ?? [],
      thumbnails: input.thumbnails ?? [],
    }
    thread.meta.queued = { text: input.text, ...(imageCount > 0 ? { imageCount } : {}) }
    thread.meta.updatedAt = Date.now()
    await persistNow(thread)
    broadcastRoster()
    return
  }

  await startTurn(thread, input)
}

/**
 * Start a turn on an idle thread: append the user item, set it working, and hand off to the
 * driver. Shared by the idle-send path (sendMessage) and the queue drain (drainQueue) — both
 * reach an idle thread, so both need the synchronous-claim guard against a racing send.
 */
async function startTurn(thread: Thread, input: SendMessageInput): Promise<void> {
  // Starting a turn supersedes any queued message and clears the last-turn-failed flag.
  thread.queued = null
  thread.meta.queued = undefined
  thread.meta.lastTurnFailed = undefined

  // Claim the turn SYNCHRONOUSLY, before the first await: `thread.turn` is only assigned
  // the real handle after `await persistNow` (several awaits away), so without this a second
  // send racing the first would also pass the guard above and start a second driver turn.
  // The token stamps this turn's identity; every callback below no-ops once it no longer
  // matches (abort started a new turn, or the thread went idle) so a late fire from an
  // exited driver process can't touch a turn it no longer owns.
  thread.turn = PENDING_TURN
  const token = Symbol('turn')
  thread.turnToken = token
  const isCurrent = () => thread.turnToken === token

  const hadUserMessage = thread.items.some((item) => item.kind === 'user')
  const imageCount = input.images?.length ?? 0
  const thumbnails = input.thumbnails ?? []
  onEmit(thread, {
    t: 'item',
    item: {
      kind: 'user',
      id: randomUUID(),
      text: input.text,
      ...(imageCount > 0 ? { imageCount } : {}),
      ...(thumbnails.length > 0 ? { thumbnails } : {}),
    },
  })
  // Auto-title on the first user message: derive immediately (instant feedback) and arm
  // the one-shot LLM upgrade that fires when this first turn succeeds (see onDone).
  if (!hadUserMessage) {
    thread.meta.title = deriveTitle(input.text)
    thread.pendingAutoTitle = true
    broadcastRoster()
  }
  // Snapshot the cumulative totals so this turn's usage reports fold in without double-
  // counting (see applyUsage).
  thread.turnUsageBase = {
    input: thread.meta.usage?.totalInput ?? 0,
    output: thread.meta.usage?.totalOutput ?? 0,
    cost: thread.meta.usage?.totalCostUsd ?? 0,
  }
  setStatus(thread, 'working')
  await persistNow(thread)

  // Aborted or deleted while we persisted — the token changed, so don't spawn a turn.
  if (!isCurrent()) return
  thread.turn = drivers[thread.meta.provider].startTurn({
    repoPath: thread.meta.repoPath,
    model: thread.meta.model,
    mode: thread.meta.mode,
    // Absent = 'build' — the Plan toggle only carries when the human flipped it.
    interaction: thread.meta.interaction ?? 'build',
    // `{}` for an untouched thread — the driver applies only the options it supports.
    options: thread.meta.options ?? {},
    resume: thread.sessionState,
    text: input.text,
    images: input.images ?? [],
    emit: (event) => {
      if (isCurrent()) onEmit(thread, event)
    },
    onSessionState: (state) => {
      if (!isCurrent()) return
      thread.sessionState = state
      schedulePersist(thread)
    },
    onDone: (result) => {
      if (isCurrent()) onDone(thread, result.ok)
    },
  })
}

/** Interrupt the running turn; the thread returns to idle. */
export async function abortTurn(id: string): Promise<void> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread || thread.turn === null) return
  thread.turn.abort()
  thread.turn = null
  thread.turnToken = null // any late emit/onDone from the killed turn is now inert
  setStatus(thread, 'idle')
  await persistNow(thread)
  // An abort is "stop this, do the next thing" — so a queued message still runs. (The aborted
  // turn's onDone is inert now, cleared by the token above, so this is the only drain path.)
  await drainQueue(thread)
}

/** Drop the thread's queued message (the composer's "Queued" chip × ). No-op if empty. */
export async function cancelQueued(id: string): Promise<void> {
  await ensureHydrated()
  const thread = threads.get(id)
  if (!thread?.queued) return
  thread.queued = null
  thread.meta.queued = undefined
  thread.meta.updatedAt = Date.now()
  await persistNow(thread)
  broadcastRoster()
}

/**
 * Await any pending (debounced or in-flight) write for a thread. Turn events persist on
 * a trailing debounce, so this forces the timeline to disk now — used on daemon
 * shutdown and by tests that read a thread file back right after a driver callback.
 */
export async function flushThread(id: string): Promise<void> {
  const thread = threads.get(id)
  if (thread) await persistNow(thread)
}

/**
 * Force every thread's pending (debounced or in-flight) write to disk. Best-effort — a
 * failed write is swallowed. Wired into the daemon's shutdown path (server.ts) so a
 * SIGTERM/SIGINT/stdin-EOF exit doesn't drop the last ~500ms of un-persisted timeline.
 */
export async function flushAllThreads(): Promise<void> {
  await Promise.all([...threads.values()].map((thread) => persistNow(thread).catch(() => {})))
}

/** Answer a pending approval the running turn is blocked on. */
export async function respondApproval(
  id: string,
  requestId: string,
  decision: ApprovalDecision,
): Promise<void> {
  await ensureHydrated()
  threads.get(id)?.turn?.respondApproval(requestId, decision)
}

/**
 * Probe every provider's status in parallel, tolerant of a missing CLI: a driver that
 * throws is reported absent rather than failing the whole call. api.ts caches the result.
 */
export async function providerStatuses(): Promise<ProviderStatus[]> {
  return Promise.all(
    agentProviderSchema.options.map(async (provider): Promise<ProviderStatus> => {
      try {
        return await drivers[provider].status()
      } catch {
        return { provider, installed: false, authenticated: false, models: [] }
      }
    }),
  )
}

/**
 * The custom slash commands a provider's CLI exposes for a repo (scanned from its command
 * `.md` files). Tolerant of a driver without the hook (returns []) or a scan failure. The
 * api layer caches this like provider statuses.
 */
export async function agentCommands(
  repoPath: string,
  provider: AgentProvider,
): Promise<AgentCommand[]> {
  try {
    return (await drivers[provider].listCommands?.(repoPath)) ?? []
  } catch {
    return []
  }
}

/**
 * A provider's live quota windows + plan (Codex's rate-limit snapshot, Claude's OAuth
 * `/usage`), or null when the driver exposes no limits (OpenCode), isn't subscription-authed,
 * or the probe fails. Tolerant of a driver without the hook and of a thrown probe. The api
 * layer caches this per provider like provider statuses.
 */
export async function agentLimits(provider: AgentProvider): Promise<ProviderLimits | null> {
  try {
    return (await drivers[provider].limits?.()) ?? null
  } catch {
    return null
  }
}

/** Swap the driver registry — tests inject a mock driver. */
export function setDrivers(next: DriverRegistry): void {
  drivers = next
}

/** Reset all in-memory state (tests run against a fresh, per-test threads dir). */
export function resetForTests(): void {
  threads.clear()
  hydration = null
  drivers = defaultDrivers
}

import { z } from 'zod'

/**
 * The Agent tab's normalized protocol: the small, reduced shapes every provider
 * driver (Claude Code, Codex, OpenCode) translates its native output into, plus the
 * pure reducer that folds live events into the persisted timeline. Shared by the
 * daemon (`src/backend/agents`, which persists the reduced state) and the renderer
 * (which holds the same reduced state live), so this module stays dependency-light
 * (zod only) and Electron-free — the reducer must produce byte-identical results on
 * both ends or an attaching client would diverge from what the daemon stored.
 */

export const agentProviderSchema = z.enum(['claude', 'codex', 'opencode'])
export type AgentProvider = z.infer<typeof agentProviderSchema>

// The three permission postures a turn runs under, mapped per-driver onto each CLI's
// own approval flags. `full` (no gate) is the default — see createThread.
export const agentModeSchema = z.enum(['approve', 'auto-edits', 'full'])
export type AgentMode = z.infer<typeof agentModeSchema>

// The thread's interaction mode — Build (do the work) vs Plan (discuss/architect first,
// no edits). SEPARATE from the permission mode: each driver maps it onto its CLI's own
// plan mechanism (Claude's `plan` permission-mode, Codex's collaborationMode, OpenCode's
// built-in `plan` agent). Absent on a thread = 'build'.
export const agentInteractionSchema = z.enum(['build', 'plan'])
export type AgentInteraction = z.infer<typeof agentInteractionSchema>

// A turn is either quiescent or actively producing output/awaiting approval. Owned by
// the manager (set on send, cleared on turn end), not by the reducer.
export const agentStatusSchema = z.enum(['idle', 'working'])
export type AgentStatus = z.infer<typeof agentStatusSchema>

// The client's reply to an approval request. Distinct from an approval item's own
// status (`accepted`/`declined`/…) — this is the human's decision, that is the result.
export const approvalDecisionSchema = z.enum(['accept', 'accept-session', 'decline'])
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>

// An attached image on an outgoing message. Base64 (not a path) so it survives the
// remote-daemon/iPad case where the client and the repo live on different machines.
export const agentImageSchema = z.object({
  mediaType: z.string(),
  base64: z.string(),
})
export type AgentImage = z.infer<typeof agentImageSchema>

// A tool item's captured output is capped when a driver reduces it, so one runaway
// command (a full test log, a big file dump) can't bloat the persisted thread or the
// snapshot every attaching client replays. Drivers enforce this; the schema stays
// permissive so an over-cap legacy file still reads back.
export const TOOL_OUTPUT_CAP = 16 * 1024

/**
 * The reduced, persisted timeline shape — the renderer renders these directly. A
 * driver never emits its native events to a client; it emits `AgentEvent`s that the
 * reducer folds into this list.
 */
export const timelineItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('user'),
    id: z.string(),
    text: z.string(),
    imageCount: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('assistant'),
    id: z.string(),
    text: z.string(),
    streaming: z.boolean(),
  }),
  z.object({
    kind: z.literal('reasoning'),
    id: z.string(),
    text: z.string(),
    streaming: z.boolean(),
  }),
  z.object({
    kind: z.literal('tool'),
    id: z.string(),
    title: z.string(),
    detail: z.string().optional(),
    status: z.enum(['running', 'ok', 'error']),
    output: z.string().optional(),
  }),
  z.object({
    kind: z.literal('approval'),
    id: z.string(),
    requestId: z.string(),
    title: z.string(),
    command: z.string().optional(),
    status: z.enum(['pending', 'accepted', 'declined', 'canceled']),
  }),
  // An agent's todo/phase checklist (Claude's TodoWrite, Codex's turn plan, OpenCode's
  // todowrite tool), normalized to one item every driver upserts under a stable id — so a
  // stream of plan updates collapses onto a single, self-replacing checklist in the timeline.
  z.object({
    kind: z.literal('plan'),
    id: z.string(),
    steps: z.array(z.object({ text: z.string(), status: z.enum(['pending', 'active', 'done']) })),
  }),
  z.object({ kind: z.literal('error'), id: z.string(), message: z.string() }),
])
export type TimelineItem = z.infer<typeof timelineItemSchema>

/**
 * The live server→client turn events, reduced with the same `applyAgentEvent` on both
 * ends. `item` carries a whole (idempotent) item; `item-delta` streams text onto an
 * open assistant/reasoning item; `status`/`meta` carry no timeline change (they move
 * thread state that lives outside the item list) and pass through the reducer untouched.
 */
export const agentEventSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('item'), item: timelineItemSchema }),
  z.object({ t: z.literal('item-delta'), id: z.string(), delta: z.string() }),
  z.object({
    t: z.literal('status'),
    status: agentStatusSchema,
    usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }).optional(),
  }),
  z.object({
    t: z.literal('meta'),
    title: z.string().optional(),
    model: z.string().optional(),
    provider: agentProviderSchema.optional(),
  }),
])
export type AgentEvent = z.infer<typeof agentEventSchema>

// A thread's per-turn model options — reasoning effort and context-window size, each an
// opaque string the driver maps onto its CLI. Both optional: an absent value means "the
// model's own default", and a model that advertises no `efforts`/`contextWindows` (below)
// simply never carries the corresponding key. The picker names are the contract with the
// renderer — `effort` / `contextWindow` — so don't rename them.
export const threadOptionsSchema = z.object({
  effort: z.string().optional(),
  contextWindow: z.string().optional(),
})
export type ThreadOptions = z.infer<typeof threadOptionsSchema>

// One roster row: the daemon-owned metadata the renderer's Agent list renders. `status`
// is runtime (a hydrated-from-disk thread is always idle); everything else persists.
export const threadInfoSchema = z.object({
  id: z.string(),
  repoPath: z.string(),
  title: z.string(),
  provider: agentProviderSchema,
  model: z.string(),
  mode: agentModeSchema,
  status: agentStatusSchema,
  // The thread's interaction mode (Build/Plan toggle). Optional — absent = 'build'.
  interaction: agentInteractionSchema.optional(),
  // The thread's chosen model options (effort/context window). Optional — an untouched
  // thread has none and each driver falls back to the model default.
  options: threadOptionsSchema.optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type ThreadInfo = z.infer<typeof threadInfoSchema>

// A per-model option descriptor: the values the picker offers plus the one to preselect.
// Absent on a ModelInfo = the model doesn't expose that control, so the picker hides the
// whole section (Haiku has no `efforts`; Opus 4.8 is always-1M so no `contextWindows`).
const modelOptionValuesSchema = z.object({
  values: z.array(z.string()),
  default: z.string(),
})

export const modelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: agentProviderSchema,
  description: z.string().optional(),
  // Reasoning-effort choices this model supports (e.g. low/medium/high/xhigh/max), if any.
  efforts: modelOptionValuesSchema.optional(),
  // Context-window choices this model toggles between (e.g. 200k/1m), if any.
  contextWindows: modelOptionValuesSchema.optional(),
})
export type ModelInfo = z.infer<typeof modelInfoSchema>

// A provider's install/auth state + its model catalog, probed from the installed CLI.
export const providerStatusSchema = z.object({
  provider: agentProviderSchema,
  installed: z.boolean(),
  authenticated: z.boolean(),
  account: z.string().optional(),
  models: z.array(modelInfoSchema),
})
export type ProviderStatus = z.infer<typeof providerStatusSchema>

/**
 * The pure timeline reducer, run by BOTH the daemon (to persist) and the renderer (to
 * hold live state), so an attaching client always converges on the daemon's stored
 * timeline. Never mutates the input array.
 *
 * - `item` upserts by id (idempotent): a re-sent item replaces its prior version in
 *   place, so a driver can promote a streaming assistant item to its final form, or
 *   flip a tool running→ok, just by re-emitting it.
 * - `item-delta` appends `delta` to an existing assistant/reasoning item and keeps it
 *   streaming. An unknown id — or a delta aimed at a non-text item — is ignored: the
 *   `item` that opens the stream always precedes its deltas.
 * - `status`/`meta` carry no timeline change, so the list passes through untouched.
 */
export function applyAgentEvent(items: TimelineItem[], event: AgentEvent): TimelineItem[] {
  switch (event.t) {
    case 'item': {
      const index = items.findIndex((item) => item.id === event.item.id)
      if (index === -1) return [...items, event.item]
      const next = [...items]
      next[index] = event.item
      return next
    }
    case 'item-delta': {
      const index = items.findIndex((item) => item.id === event.id)
      if (index === -1) return items
      const target = items[index]
      if (target.kind !== 'assistant' && target.kind !== 'reasoning') return items
      const next = [...items]
      next[index] = { ...target, text: target.text + event.delta, streaming: true }
      return next
    }
    case 'status':
    case 'meta':
      return items
  }
}

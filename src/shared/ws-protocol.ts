import { z } from 'zod'
import {
  agentEventSchema,
  agentStatusSchema,
  approvalDecisionSchema,
  timelineItemSchema,
} from './agent-protocol'

/**
 * The daemon's WS session protocol (`ws://127.0.0.1:<port>/session`) — one socket
 * per window, carrying everything that isn't request/response tRPC: app-event
 * pushes, the bidirectional terminal byte stream (create/attach/detach/write/
 * resize/kill out, data/exit/attached in — PTYs are daemon-owned and outlive the
 * socket, so a reconnecting or second client `attach`es to replay scrollback and
 * resume), and the watch registrations (per-connection state, so they live on the
 * session, not the router).
 * Both ends validate every message with these schemas: the daemon because the
 * socket is an external input, the renderer so a protocol drift fails loudly
 * instead of silently mis-shaping data. Shared by src/backend (runtime) and the
 * renderer (`@shared/ws-protocol`), so this module must stay dependency-light
 * (zod only) and Electron-free.
 */

/**
 * The daemon-side push events. `close-tab` and `update-status` are NOT here —
 * they stay on the Electron shell-event channel (`src/main/shell-events.ts`)
 * because Cmd+W routing and the updater live in the shell. Broadcast events
 * (agent-channel refreshes) go to every session; `working-tree`/`file-tree` are
 * targeted at the session that registered the watch.
 */
export const appEventSchema = z.enum([
  'feature-view',
  'comments',
  'board',
  'actions',
  'layers',
  'artifact',
  'working-tree',
  'file-tree',
  // Broadcast when the Agent thread roster changes (create/rename/delete, or a
  // thread's status/model flips) → the renderer invalidates its roster query.
  'agent-threads',
])

export type AppEvent = z.infer<typeof appEventSchema>

export const serverMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('app-event'), event: appEventSchema }),
  z.object({ t: z.literal('terminal:data'), id: z.string(), data: z.string() }),
  z.object({ t: z.literal('terminal:exit'), id: z.string(), exitCode: z.number() }),
  // Answers a `terminal:create`; `reqId` correlates it back to the caller's promise.
  z.object({ t: z.literal('terminal:created'), reqId: z.string(), id: z.string() }),
  // Answers a `terminal:attach`; carries the replay scrollback and the session's
  // current state. `found=false` (empty scrollback) means the id is unknown to the
  // daemon (killed, or a stale reference); it precedes any subsequent `terminal:data`
  // so the client can write the snapshot before live output follows.
  z.object({
    t: z.literal('terminal:attached'),
    reqId: z.string(),
    id: z.string(),
    scrollback: z.string(),
    status: z.enum(['running', 'exited']),
    exitCode: z.number().optional(),
    found: z.boolean(),
  }),
  // One live turn event for a thread, fanned out ONLY to senders attached to it.
  z.object({ t: z.literal('agent:event'), threadId: z.string(), event: agentEventSchema }),
  // Answers an `agent:attach`; carries the reduced timeline snapshot + current status.
  // `found=false` (empty items) means the id is unknown to the daemon; it precedes any
  // subsequent `agent:event` so the client seeds its state before live events follow.
  z.object({
    t: z.literal('agent:attached'),
    reqId: z.string(),
    threadId: z.string(),
    found: z.boolean(),
    items: z.array(timelineItemSchema),
    status: agentStatusSchema,
  }),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('terminal:create'),
    reqId: z.string(),
    name: z.string(),
    cwd: z.string(),
    initialInput: z.string().optional(),
    cols: z.number().int().positive().optional(),
    rows: z.number().int().positive().optional(),
  }),
  // Attach to a daemon-owned PTY (reconnect, second client, or opening a session
  // hydrated from the roster after a reload); the daemon replies `terminal:attached`.
  z.object({ t: z.literal('terminal:attach'), id: z.string(), reqId: z.string() }),
  // Stop streaming a PTY to this client without killing it (the PTY lives on).
  z.object({ t: z.literal('terminal:detach'), id: z.string() }),
  z.object({ t: z.literal('terminal:write'), id: z.string(), data: z.string() }),
  z.object({
    t: z.literal('terminal:resize'),
    id: z.string(),
    cols: z.number().int(),
    rows: z.number().int(),
  }),
  z.object({ t: z.literal('terminal:kill'), id: z.string() }),
  z.object({ t: z.literal('watch:files'), paths: z.array(z.string()) }),
  z.object({ t: z.literal('watch:dirs'), paths: z.array(z.string()) }),
  // Attach to a daemon-owned thread (reconnect, second client, or opening a thread
  // hydrated from the roster); the daemon replies `agent:attached` with the snapshot.
  z.object({ t: z.literal('agent:attach'), threadId: z.string(), reqId: z.string() }),
  // Stop streaming a thread's events to this client (the thread lives on).
  z.object({ t: z.literal('agent:detach'), threadId: z.string() }),
  // Start a turn — or, if the thread is already working, QUEUE this message (one slot,
  // last-write-wins) to auto-run when the turn ends. The caps bound an external input: text
  // length, image count, and each image's base64 size (~10MB) so a hostile socket can't
  // exhaust daemon memory. `thumbnails` are the renderer-downscaled previews persisted in the
  // timeline (small: ~256px JPEG); the full `images` go to the CLI live and are never stored.
  z.object({
    t: z.literal('agent:send'),
    threadId: z.string(),
    text: z.string().max(200_000),
    images: z
      .array(z.object({ mediaType: z.string(), base64: z.string().max(10 * 1024 * 1024) }))
      .max(8)
      .optional(),
    thumbnails: z
      .array(z.object({ mediaType: z.string(), base64: z.string().max(512 * 1024) }))
      .max(8)
      .optional(),
  }),
  z.object({ t: z.literal('agent:abort'), threadId: z.string() }),
  // Drop the thread's queued message (the composer's "Queued" chip × ). No-op if empty.
  z.object({ t: z.literal('agent:cancel-queued'), threadId: z.string() }),
  z.object({
    t: z.literal('agent:approve'),
    threadId: z.string(),
    requestId: z.string(),
    decision: approvalDecisionSchema,
  }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

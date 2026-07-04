import { z } from 'zod'

/**
 * The daemon's WS session protocol (`ws://127.0.0.1:<port>/session`) — one socket
 * per window, carrying everything that isn't request/response tRPC: app-event
 * pushes, the bidirectional terminal byte stream, and the watch registrations
 * (which are per-connection state, so they live on the session, not the router).
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
])

export type AppEvent = z.infer<typeof appEventSchema>

export const serverMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('app-event'), event: appEventSchema }),
  z.object({ t: z.literal('terminal:data'), id: z.string(), data: z.string() }),
  z.object({ t: z.literal('terminal:exit'), id: z.string(), exitCode: z.number() }),
  // Answers a `terminal:create`; `reqId` correlates it back to the caller's promise.
  z.object({ t: z.literal('terminal:created'), reqId: z.string(), id: z.string() }),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('terminal:create'),
    reqId: z.string(),
    cwd: z.string(),
    initialInput: z.string().optional(),
    cols: z.number().int().positive().optional(),
    rows: z.number().int().positive().optional(),
  }),
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
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

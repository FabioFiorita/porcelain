import { z } from 'zod'

/**
 * The daemon's WS session protocol (`ws://127.0.0.1:<port>/session`) — one socket
 * per window, carrying everything that isn't request/response tRPC: app-event
 * pushes, the bidirectional terminal byte stream (create/attach/detach/write/
 * resize/kill out, data/exit/attached in — PTYs are daemon-owned and outlive the
 * socket, so a reconnecting or second client `attach`es to replay scrollback and
 * resume), and the watch registrations (per-connection state, so they live on the
 * session, not the router).
 * Both ends validate every message with these schemas: the daemon because the
 * socket is an external input, the client so a protocol drift fails loudly
 * instead of silently mis-shaping data. Crosses the client boundary
 * (`@porcelain/contracts`), so this module must stay dependency-light (zod only)
 * and Electron-free.
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
  'evidence',
  'scope',
  'working-tree',
  'file-tree',
])

export type AppEvent = z.infer<typeof appEventSchema>

/**
 * The real cap for a pasted image, decoded. Checked inside the daemon's handler
 * (`apps/daemon/src/terminal/image-paste.ts`), not by the zod schema below — a
 * schema-level cap that failed would drop the message before `reqId` could ever be
 * answered, leaving the client's pending paste promise hanging forever (see
 * `dataBase64`'s own comment). 4 MiB is the same order of magnitude as
 * `evidence-store.ts`'s `MAX_HTML_BYTES`, comfortably above a real full-resolution
 * screenshot and well under the daemon's generic 10 MiB read ceiling.
 */
export const MAX_PASTE_IMAGE_BYTES = 4_194_304

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
  // Answers a `terminal:paste-image`. `result` is a reason enum, not free text — each
  // client owns its own copy for whatever it shows (mobile has no toast, only
  // `Alert.alert`). `path` is present only on `ok`, for callers that want it (tests,
  // logging); the client never needs to act on it, since the daemon has already
  // written the mention into the PTY itself.
  z.object({
    t: z.literal('terminal:image-pasted'),
    reqId: z.string(),
    id: z.string(),
    result: z.enum(['ok', 'too-large', 'no-session', 'write-failed']),
    path: z.string().optional(),
  }),
])

export type ServerMessage = z.infer<typeof serverMessageSchema>

export const clientMessageSchema = z.discriminatedUnion('t', [
  // Optional display data (which repo this client is looking at). Identity is the
  // credential the upgrade already authenticated — never anything the client says.
  // Capped: peer-supplied string held per session must not be a free memory sink.
  z.object({ t: z.literal('session:hello'), repo: z.string().max(1024).optional() }),
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
  // A pasted image, client → daemon. `dataBase64`'s `.max()` is a coarse memory-sink
  // backstop only (roomy above `MAX_PASTE_IMAGE_BYTES`'s decoded cap, to survive
  // base64's ~4/3 blowup) — a schema failure here means `handleMessage` drops the
  // message before it can look up `reqId` to reply, so the REAL cap is enforced
  // inside the handler, where a `too-large` reply can actually be sent back.
  z.object({
    t: z.literal('terminal:paste-image'),
    id: z.string(),
    reqId: z.string(),
    mime: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
    dataBase64: z.string().max(8_388_608),
  }),
  z.object({ t: z.literal('watch:files'), paths: z.array(z.string()) }),
  z.object({ t: z.literal('watch:dirs'), paths: z.array(z.string()) }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

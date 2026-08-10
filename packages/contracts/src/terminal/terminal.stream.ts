import { z } from 'zod'
import { terminalStatusSchema } from './terminal.contract'

/**
 * The terminal stream protocol: PTY lifecycle, ordered output, and the input a client pushes
 * into a session. Transcribed from the terminal half of `../ws-protocol.ts`, including every
 * one of its resource caps.
 *
 * Terminal is a stateful stream, not a change notification, and stays out of the session
 * change union on purpose. It keeps explicit commands, `reqId` correlation, attachment,
 * ordered output, exit state, and its own recovery story: PTYs are daemon-owned and outlive
 * the socket, so a reconnecting or second client attaches, replays the scrollback snapshot,
 * and only then consumes live output. Encoding those bytes as invalidations would throw all
 * of that away.
 */

/**
 * The real cap for a pasted image, decoded. The daemon's paste handler enforces it, not the
 * schema below: a schema-level failure would drop the frame before `reqId` could be answered,
 * leaving the client's pending paste promise hanging forever.
 */
export const MAX_PASTE_IMAGE_BYTES = 4_194_304

/**
 * A generic terminal attachment is deliberately modest: it crosses a WebSocket before the
 * daemon can put it on disk, and the terminal is not a bulk-file-transfer channel.
 */
export const MAX_PASTE_FILE_BYTES = 8_388_608

/** One PTY write must fit in one bounded WebSocket frame. */
export const MAX_TERMINAL_WRITE_CODE_UNITS = 65_536

/** Largest accepted session frame, including JSON/base64 overhead for an 8 MiB attachment. */
export const MAX_SESSION_MESSAGE_BYTES = 12 * 1024 * 1024

/**
 * Coarse memory-sink backstops on the encoded payloads, roomy above the decoded caps to
 * survive base64's ~4/3 blowup. They are not the real limits — see `MAX_PASTE_IMAGE_BYTES`.
 */
export const MAX_PASTE_IMAGE_BASE64_CODE_UNITS = 8_388_608
export const MAX_PASTE_FILE_BASE64_CODE_UNITS = 11_184_812

/** Attachment display names the daemon turns into a path it mints itself. */
export const MAX_PASTE_FILENAME_CODE_UNITS = 255
export const MAX_PASTE_MIME_CODE_UNITS = 255

export const PASTE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const
export const pasteImageMimeSchema = z.enum(PASTE_IMAGE_MIME_TYPES)
export type PasteImageMime = z.infer<typeof pasteImageMimeSchema>

export const PASTE_RESULTS = ['ok', 'too-large', 'no-session', 'write-failed'] as const
export const pasteResultSchema = z.enum(PASTE_RESULTS)
export type PasteResult = z.infer<typeof pasteResultSchema>

// ---------------------------------------------------------------------------
// Lifecycle: creating, attaching, detaching, resizing, killing, and ending a PTY.
// ---------------------------------------------------------------------------

export const terminalCreateSchema = z
  .object({
    t: z.literal('terminal:create'),
    reqId: z.string(),
    name: z.string(),
    cwd: z.string(),
    initialInput: z.string().optional(),
    cols: z.number().int().positive().optional(),
    rows: z.number().int().positive().optional(),
  })
  .strict()

/**
 * Answers a `terminal:create`. The empty id is the only "there is no session" value this
 * frame can express, which is how a refused create still settles the caller's promise.
 */
export const terminalCreatedSchema = z
  .object({
    t: z.literal('terminal:created'),
    reqId: z.string(),
    id: z.string(),
  })
  .strict()

export const terminalAttachSchema = z
  .object({
    t: z.literal('terminal:attach'),
    reqId: z.string(),
    id: z.string(),
  })
  .strict()

/**
 * Answers a `terminal:attach` with the replay scrollback and the session's current state.
 * `found: false` (empty scrollback) means the id is unknown to the daemon — killed, or a
 * stale reference. It precedes any following `terminal:data`, so the client writes the
 * snapshot before live output follows.
 */
export const terminalAttachedSchema = z
  .object({
    t: z.literal('terminal:attached'),
    reqId: z.string(),
    id: z.string(),
    scrollback: z.string(),
    status: terminalStatusSchema,
    exitCode: z.number().optional(),
    found: z.boolean(),
  })
  .strict()

/** Stop streaming a PTY to this client without killing it; the PTY lives on. */
export const terminalDetachSchema = z
  .object({ t: z.literal('terminal:detach'), id: z.string() })
  .strict()

export const terminalResizeSchema = z
  .object({
    t: z.literal('terminal:resize'),
    id: z.string(),
    cols: z.number().int(),
    rows: z.number().int(),
  })
  .strict()

export const terminalKillSchema = z
  .object({ t: z.literal('terminal:kill'), id: z.string() })
  .strict()

export const terminalExitSchema = z
  .object({ t: z.literal('terminal:exit'), id: z.string(), exitCode: z.number() })
  .strict()

export const terminalLifecycleFrameSchema = z.discriminatedUnion('t', [
  terminalCreateSchema,
  terminalCreatedSchema,
  terminalAttachSchema,
  terminalAttachedSchema,
  terminalDetachSchema,
  terminalResizeSchema,
  terminalKillSchema,
  terminalExitSchema,
])
export type TerminalLifecycleFrame = z.infer<typeof terminalLifecycleFrameSchema>

// ---------------------------------------------------------------------------
// Output: ordered PTY bytes, daemon → client.
// ---------------------------------------------------------------------------

/**
 * PTY output carries only the transport-level frame cap (`MAX_SESSION_MESSAGE_BYTES`). The
 * interactive write cap must not be reused here or a burst from a noisy process would vanish
 * client-side.
 */
export const terminalDataSchema = z
  .object({ t: z.literal('terminal:data'), id: z.string(), data: z.string() })
  .strict()

export const terminalOutputFrameSchema = z.discriminatedUnion('t', [terminalDataSchema])
export type TerminalOutputFrame = z.infer<typeof terminalOutputFrameSchema>

// ---------------------------------------------------------------------------
// Input: bytes and attachments a client pushes into the PTY, and their replies.
// ---------------------------------------------------------------------------

export const terminalWriteSchema = z
  .object({
    t: z.literal('terminal:write'),
    id: z.string(),
    data: z.string().max(MAX_TERMINAL_WRITE_CODE_UNITS),
  })
  .strict()

/**
 * A pasted image, client → daemon. `insert` omitted preserves immediate paste; `false`
 * uploads without mutating the prompt, so a multi-image composer can await every upload and
 * issue one complete terminal write.
 */
export const terminalPasteImageSchema = z
  .object({
    t: z.literal('terminal:paste-image'),
    id: z.string(),
    reqId: z.string(),
    mime: pasteImageMimeSchema,
    dataBase64: z.string().max(MAX_PASTE_IMAGE_BASE64_CODE_UNITS),
    insert: z.boolean().optional(),
  })
  .strict()

/**
 * Generic attachments use the same daemon-owned scratch area as images. The client never
 * sends a local path: it sends bytes plus a display name, and the daemon mints the path.
 */
export const terminalPasteFileSchema = z
  .object({
    t: z.literal('terminal:paste-file'),
    id: z.string(),
    reqId: z.string(),
    filename: z.string().min(1).max(MAX_PASTE_FILENAME_CODE_UNITS),
    mime: z.string().max(MAX_PASTE_MIME_CODE_UNITS),
    dataBase64: z.string().max(MAX_PASTE_FILE_BASE64_CODE_UNITS),
    insert: z.boolean().optional(),
  })
  .strict()

/**
 * Answers a paste. `result` is a reason enum, not free text — each client owns whatever it
 * shows. `path` is present only on `ok`, for callers that want it; the daemon has already
 * written the mention into the PTY itself.
 */
export const terminalImagePastedSchema = z
  .object({
    t: z.literal('terminal:image-pasted'),
    reqId: z.string(),
    id: z.string(),
    result: pasteResultSchema,
    path: z.string().optional(),
  })
  .strict()

export const terminalFilePastedSchema = z
  .object({
    t: z.literal('terminal:file-pasted'),
    reqId: z.string(),
    id: z.string(),
    result: pasteResultSchema,
    path: z.string().optional(),
  })
  .strict()

export const terminalInputFrameSchema = z.discriminatedUnion('t', [
  terminalWriteSchema,
  terminalPasteImageSchema,
  terminalPasteFileSchema,
  terminalImagePastedSchema,
  terminalFilePastedSchema,
])
export type TerminalInputFrame = z.infer<typeof terminalInputFrameSchema>

/** Representative terminal stream values used by boundary tests and client mocks. */
export const terminalStreamFixtures = {
  lifecycle: {
    create: { t: 'terminal:create', reqId: 'req-1', name: 'zsh', cwd: '/synthetic/repo' },
    created: { t: 'terminal:created', reqId: 'req-1', id: 'term-1' },
    attach: { t: 'terminal:attach', reqId: 'req-2', id: 'term-1' },
    attached: {
      t: 'terminal:attached',
      reqId: 'req-2',
      id: 'term-1',
      scrollback: '$ pnpm lint\n',
      status: 'running',
      found: true,
    },
    detach: { t: 'terminal:detach', id: 'term-1' },
    resize: { t: 'terminal:resize', id: 'term-1', cols: 120, rows: 40 },
    kill: { t: 'terminal:kill', id: 'term-1' },
    exit: { t: 'terminal:exit', id: 'term-1', exitCode: 0 },
  },
  output: {
    data: { t: 'terminal:data', id: 'term-1', data: 'hello\r\n' },
  },
  input: {
    write: { t: 'terminal:write', id: 'term-1', data: 'pnpm lint\r' },
    pasteImage: {
      t: 'terminal:paste-image',
      id: 'term-1',
      reqId: 'req-3',
      mime: 'image/png',
      dataBase64: 'aW1hZ2U=',
    },
    pasteFile: {
      t: 'terminal:paste-file',
      id: 'term-1',
      reqId: 'req-4',
      filename: 'evidence.txt',
      mime: 'text/plain',
      dataBase64: 'ZmlsZQ==',
    },
    imagePasted: {
      t: 'terminal:image-pasted',
      reqId: 'req-3',
      id: 'term-1',
      result: 'ok',
      path: '/synthetic/scratch/pasted.png',
    },
    filePasted: {
      t: 'terminal:file-pasted',
      reqId: 'req-4',
      id: 'term-1',
      result: 'too-large',
    },
  },
} as const

import { z } from 'zod'
import { terminalStatusSchema } from './terminal.contract'
import { terminalPublicErrorSchema } from './terminal.errors'

/**
 * The terminal stream protocol: PTY lifecycle, ordered output, and the input a client pushes
 * into a session. Transcribed from the terminal half of the deleted horizontal session protocol, including every
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
 * A generic terminal attachment is deliberately modest: it crosses a WebSocket before the
 * daemon can put it on disk, and the terminal is not a bulk-file-transfer channel.
 */
export const MAX_PASTE_FILE_BYTES = 8_388_608

/** One PTY write must fit in one bounded WebSocket frame. */
export const MAX_TERMINAL_WRITE_CODE_UNITS = 65_536

/** Maximum replay snapshot accepted in one attach reply, measured in UTF-16 code units. */
export const MAX_TERMINAL_SCROLLBACK_CODE_UNITS = 64 * 1024

/** Largest accepted session frame, including JSON/base64 overhead for an 8 MiB attachment. */
export const MAX_SESSION_MESSAGE_BYTES = 12 * 1024 * 1024

/**
 * Coarse memory-sink backstop on the encoded payload, roomy above the decoded cap to survive
 * base64's ~4/3 blowup. It is not the real limit — see `MAX_PASTE_FILE_BYTES`.
 */
export const MAX_PASTE_FILE_BASE64_CODE_UNITS = 11_184_812

/** Attachment display names the daemon turns into a path it mints itself. */
export const MAX_PASTE_FILENAME_CODE_UNITS = 255
export const MAX_PASTE_MIME_CODE_UNITS = 255

export const PASTE_RESULTS = ['ok'] as const
export const pasteResultSchema = z.enum(PASTE_RESULTS)
export type PasteResult = z.infer<typeof pasteResultSchema>

export const terminalIdSchema = z.string().min(1)
export const terminalRequestIdSchema = z.string().min(1)
export const terminalEpochSchema = z.string().min(1)
export const terminalSequenceSchema = z.number().int().nonnegative()

// ---------------------------------------------------------------------------
// Lifecycle: creating, attaching, detaching, resizing, killing, and ending a PTY.
// ---------------------------------------------------------------------------

export const terminalCreateSchema = z
  .object({
    t: z.literal('terminal:create'),
    reqId: terminalRequestIdSchema,
    name: z.string(),
    cwd: z.string(),
    initialInput: z.string().optional(),
    cols: z.number().int().positive().optional(),
    rows: z.number().int().positive().optional(),
  })
  .strict()

/**
 * Answers a successful `terminal:create`. Refused creates use the correlated terminal:error
 * frame instead of an empty-id sentinel.
 */
export const terminalCreatedSchema = z
  .object({
    t: z.literal('terminal:created'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
  })
  .strict()

export const terminalAttachSchema = z
  .object({
    t: z.literal('terminal:attach'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
  })
  .strict()

/**
 * Answers a `terminal:attach` with the replay scrollback and the session's current state.
 * The epoch and sequence are the baseline for following `terminal:data` and `terminal:exit`
 * frames. Unknown ids use the correlated terminal:error frame instead of a found sentinel.
 */
export const terminalAttachedSchema = z
  .object({
    t: z.literal('terminal:attached'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
    scrollback: z.string().max(MAX_TERMINAL_SCROLLBACK_CODE_UNITS),
    status: terminalStatusSchema,
    exitCode: z.number().optional(),
    epoch: terminalEpochSchema,
    sequence: terminalSequenceSchema,
  })
  .strict()

/** Stop streaming a PTY to this client without killing it; the PTY lives on. */
export const terminalDetachSchema = z
  .object({ t: z.literal('terminal:detach'), reqId: terminalRequestIdSchema, id: terminalIdSchema })
  .strict()

export const terminalResizeSchema = z
  .object({
    t: z.literal('terminal:resize'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
    cols: z.number().int(),
    rows: z.number().int(),
  })
  .strict()

export const terminalKillSchema = z
  .object({ t: z.literal('terminal:kill'), reqId: terminalRequestIdSchema, id: terminalIdSchema })
  .strict()

export const terminalExitSchema = z
  .object({
    t: z.literal('terminal:exit'),
    id: terminalIdSchema,
    exitCode: z.number(),
    epoch: terminalEpochSchema,
    sequence: terminalSequenceSchema,
  })
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
  .object({
    t: z.literal('terminal:data'),
    id: terminalIdSchema,
    data: z.string(),
    epoch: terminalEpochSchema,
    sequence: terminalSequenceSchema,
  })
  .strict()

export const terminalOutputFrameSchema = z.discriminatedUnion('t', [terminalDataSchema])
export type TerminalOutputFrame = z.infer<typeof terminalOutputFrameSchema>

// ---------------------------------------------------------------------------
// Input: bytes and attachments a client pushes into the PTY, and their replies.
// ---------------------------------------------------------------------------

export const terminalWriteSchema = z
  .object({
    t: z.literal('terminal:write'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
    data: z.string().max(MAX_TERMINAL_WRITE_CODE_UNITS),
  })
  .strict()

/**
 * Generic attachments use the same daemon-owned scratch area as images. The client never
 * sends a local path: it sends bytes plus a display name, and the daemon mints the path.
 */
export const terminalPasteFileSchema = z
  .object({
    t: z.literal('terminal:paste-file'),
    id: terminalIdSchema,
    reqId: terminalRequestIdSchema,
    filename: z.string().min(1).max(MAX_PASTE_FILENAME_CODE_UNITS),
    mime: z.string().max(MAX_PASTE_MIME_CODE_UNITS),
    dataBase64: z.string().max(MAX_PASTE_FILE_BASE64_CODE_UNITS),
    insert: z.boolean().optional(),
  })
  .strict()

/**
 * Answers a successful paste. `result` remains an explicit success marker and `path` is
 * present when the daemon wrote an attachment to its scratch area. Expected failures use the
 * correlated terminal:error frame.
 */
export const terminalFilePastedSchema = z
  .object({
    t: z.literal('terminal:file-pasted'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema,
    result: pasteResultSchema,
    path: z.string().optional(),
  })
  .strict()

export const terminalInputFrameSchema = z.discriminatedUnion('t', [
  terminalWriteSchema,
  terminalPasteFileSchema,
  terminalFilePastedSchema,
])
export type TerminalInputFrame = z.infer<typeof terminalInputFrameSchema>

export const terminalClientFrameSchema = z.discriminatedUnion('t', [
  terminalCreateSchema,
  terminalAttachSchema,
  terminalDetachSchema,
  terminalResizeSchema,
  terminalKillSchema,
  terminalWriteSchema,
  terminalPasteFileSchema,
])
export type TerminalClientFrame = z.infer<typeof terminalClientFrameSchema>

/** Correlated expected Terminal failures use the common public error vocabulary. */
export const terminalErrorFrameSchema = z
  .object({
    t: z.literal('terminal:error'),
    reqId: terminalRequestIdSchema,
    id: terminalIdSchema.optional(),
    error: terminalPublicErrorSchema,
  })
  .strict()

export const terminalServerFrameSchema = z.discriminatedUnion('t', [
  terminalCreatedSchema,
  terminalAttachedSchema,
  terminalDataSchema,
  terminalExitSchema,
  terminalFilePastedSchema,
  terminalErrorFrameSchema,
])
export type TerminalServerFrame = z.infer<typeof terminalServerFrameSchema>

/** Prompt text that makes one daemon-stored non-image attachment visible to an agent. */
export function terminalFilePromptReference(path: string): string {
  const quotedPath = path.includes(' ') ? `"${path}"` : path
  return `Analyze this file: ${quotedPath} `
}

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
      epoch: 'epoch-1',
      sequence: 0,
    },
    detach: { t: 'terminal:detach', reqId: 'req-5', id: 'term-1' },
    resize: { t: 'terminal:resize', reqId: 'req-6', id: 'term-1', cols: 120, rows: 40 },
    kill: { t: 'terminal:kill', reqId: 'req-7', id: 'term-1' },
    exit: { t: 'terminal:exit', id: 'term-1', exitCode: 0, epoch: 'epoch-1', sequence: 2 },
  },
  output: {
    data: {
      t: 'terminal:data',
      id: 'term-1',
      data: 'hello\r\n',
      epoch: 'epoch-1',
      sequence: 1,
    },
  },
  input: {
    write: { t: 'terminal:write', reqId: 'req-8', id: 'term-1', data: 'pnpm lint\r' },
    pasteFile: {
      t: 'terminal:paste-file',
      id: 'term-1',
      reqId: 'req-4',
      filename: 'evidence.txt',
      mime: 'text/plain',
      dataBase64: 'ZmlsZQ==',
    },
    filePasted: {
      t: 'terminal:file-pasted',
      reqId: 'req-4',
      id: 'term-1',
      result: 'ok',
      path: '/synthetic/scratch/evidence.txt',
    },
  },
  error: {
    t: 'terminal:error',
    reqId: 'req-2',
    id: 'term-gone',
    error: {
      code: 'terminal.not-found',
      category: 'not-found',
      message: 'The terminal session was not found.',
      retryable: false,
      requestId: '00000000-0000-4000-8000-000000000016',
    },
  },
} as const

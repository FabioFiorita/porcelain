import { z } from 'zod'
import type { ShellEvent } from '../main/shell-events'

/**
 * The serialized-HTTP shuttle the shell tRPC channel rides over Electron IPC.
 *
 * Shell-local, not a public wire contract: nothing here leaves the process, so these
 * schemas stay beside the bridge instead of in `packages/contracts`. They exist because
 * `ipcRenderer.invoke` erases every type — main used to build a `Request` straight out of
 * an `unknown` payload it had only annotated, and the preload handed the reply back
 * unchecked. Renderer, preload, and main now share ONE definition each way.
 *
 * Semantics match what `new Request` / `new Response` accept for this shuttle: absolute
 * URL, GET|POST only (the httpBatchLink verbs), constructible headers, no body on GET,
 * and a Response status in the Fetch-constructor range. Structural parse alone is not
 * enough — values that would throw at construction fail the schema too.
 */

/** Header names Fetch accepts (HTTP token; no spaces / colons / controls). */
const httpHeaderNameSchema = z
  .string()
  .min(1)
  .regex(/^[\w!#$%&'*+.^`|~-]+$/)

/** Header values Fetch accepts (no NUL / CR / LF). */
const httpHeaderValueSchema = z.string().regex(/^[^\r\n\0]*$/)

const httpHeadersSchema = z.record(httpHeaderNameSchema, httpHeaderValueSchema)

export const trpcShellRequestSchema = z
  .object({
    // Absolute URL string `new Request` can parse — relative paths throw.
    url: z.string().url(),
    // Exact shuttle verbs: the shell link only ever sends GET (bodyless) or POST.
    method: z.enum(['GET', 'POST']),
    headers: httpHeadersSchema,
    body: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // GET (and HEAD, if it ever appeared) cannot carry a body — Request throws otherwise.
    if (value.method === 'GET' && value.body !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'GET request cannot include a body',
        path: ['body'],
      })
    }
  })

export const trpcShellResponseSchema = z
  .object({
    // undici / Fetch `Response` constructor: status must be an int in 200..599.
    status: z.number().int().min(200).max(599),
    headers: httpHeadersSchema,
    body: z.string(),
  })
  .strict()

export type TrpcShellRequest = z.infer<typeof trpcShellRequestSchema>
export type TrpcShellResponse = z.infer<typeof trpcShellResponseSchema>

type TrpcShuttle = (request: TrpcShellRequest) => Promise<TrpcShellResponse>

/**
 * The daemon pair the preload fetches synchronously at window boot and re-reads on
 * `daemon-url-changed`. Parsed rather than hand-narrowed so a shape drift in main fails
 * closed instead of reaching the renderer half-formed or as a fabricated empty pair.
 */
export const daemonInfoSchema = z
  .object({
    url: z.string(),
    token: z.string(),
  })
  .strict()

export type DaemonInfo = z.infer<typeof daemonInfoSchema>

/**
 * What the preload exposes on `window.porcelain`. Lives here, not on either
 * side, so the implementation (`preload/index.ts`) and the consumer
 * (`renderer/lib/trpc.ts`) check against ONE shape — they were two
 * hand-maintained copies with nothing to catch drift. `trpcShell` shuttles the
 * SHELL router only; everything else rides the daemon WS session.
 */
export interface PorcelainBridge {
  trpcShell: TrpcShuttle
  onShellEvent: (callback: (event: ShellEvent) => void) => () => void
  daemon: {
    url: string
    /** The session token gating every daemon request (see backend/server.ts). */
    token: string
    onUrlChanged: (callback: (info: DaemonInfo) => void) => () => void
  }
  /** True only under the e2e harness; gates the terminal buffer-read test hook. */
  e2e: boolean
  /** The desktop OS the shell runs on. Absent on the browser client — read via `window.porcelain?.platform`. */
  platform: 'darwin' | 'linux' | 'win32'
}

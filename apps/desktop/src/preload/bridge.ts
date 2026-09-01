import { z } from 'zod'
import type { ShellEvent } from '../main/shell-events'

/**
 * No JIT in this module — MUST stay above the schema definitions below.
 *
 * Zod compiles an object schema's fast path with `new Function`, and it decides whether it
 * may at CONSTRUCTION time by probing `new Function('')` once and caching the answer. The
 * preload is the one place where that probe lies: it runs at document-start, BEFORE the
 * renderer document's `<meta http-equiv="Content-Security-Policy">` (apps/web/index.html,
 * `script-src 'self' 'wasm-unsafe-eval'` — no `unsafe-eval`) is in force. So the probe
 * succeeds, the fast path is armed, and every later `safeParse` throws
 * `EvalError: Code generation from strings disallowed for this context` — which surfaces
 * in the renderer as a `TRPCClientError` on EVERY shell-router call, taking window init,
 * environment status, and new windows down with it (v0.53.0 regression).
 *
 * Only the preload needs this. Measured in the built shell: `new Function` in the renderer's
 * own world still answers ALLOWED, so the schemas in `apps/web` are unaffected — it is the
 * preload's isolated world that inherits the document policy, and only after the preload has
 * already run and cached its answer.
 */
z.config({ jitless: true })

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
    url: z.url().refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
      message: 'daemon URL must use HTTP or HTTPS',
    }),
    token: z.string().min(1),
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

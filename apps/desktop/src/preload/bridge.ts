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
 */
export const trpcShellRequestSchema = z
  .object({
    url: z.string().min(1),
    method: z.string().min(1),
    headers: z.record(z.string(), z.string()),
    body: z.string().optional(),
  })
  .strict()

export const trpcShellResponseSchema = z
  .object({
    status: z.number().int(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
  })
  .strict()

export type TrpcShellRequest = z.infer<typeof trpcShellRequestSchema>
export type TrpcShellResponse = z.infer<typeof trpcShellResponseSchema>

type TrpcShuttle = (request: TrpcShellRequest) => Promise<TrpcShellResponse>

/**
 * The daemon pair the preload fetches synchronously at window boot and re-reads on
 * `daemon-url-changed`. Parsed rather than hand-narrowed so a shape drift in main falls
 * back to the empty pair instead of reaching the renderer half-formed.
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

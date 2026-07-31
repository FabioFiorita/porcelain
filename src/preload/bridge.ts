import type { ShellEvent } from '../main/shell-events'

/** The serialized-HTTP shuttle the shell tRPC channel rides over Electron IPC. */
type TrpcShuttle = (request: {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}) => Promise<{ status: number; headers: Record<string, string>; body: string }>

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
    onUrlChanged: (callback: (info: { url: string; token: string }) => void) => () => void
  }
  /** True only under the e2e harness; gates the terminal buffer-read test hook. */
  e2e: boolean
  /** The desktop OS the shell runs on. Absent on the browser client — read via `window.porcelain?.platform`. */
  platform: 'darwin' | 'linux' | 'win32'
}

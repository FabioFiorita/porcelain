import { z } from 'zod'

/**
 * Development servers — the daemon-owned long-lived process records of the Terminal domain.
 *
 * A development server is not a second process subsystem: it is one PTY session (the same
 * machinery a Terminal tab attaches to) plus a record that names *which* work it belongs to.
 * The record is what survives Viewer detach, Worktree switching, reload, and window closure;
 * only an explicit `stopDevServer` ends the process.
 *
 * The Environment is implicit — the owning daemon is the Environment — so the target carries
 * Project + Worktree + checkout path and nothing else. There is no ambient "current repo"
 * fallback on this wire: a start without an explicit target cannot be expressed.
 */

export const DEV_SERVER_STATUS_VALUES = ['starting', 'running', 'exited', 'stopped'] as const
export const devServerStatusSchema = z.enum(DEV_SERVER_STATUS_VALUES)
export type DevServerStatus = z.infer<typeof devServerStatusSchema>

/**
 * The explicit work a development server belongs to. `path` is the Worktree checkout the
 * process runs in; `worktreeId` is the stable identity that outlives a moved checkout.
 */
export const devServerTargetSchema = z
  .object({
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
    path: z.string().min(1),
  })
  .strict()
export type DevServerTarget = z.infer<typeof devServerTargetSchema>

/**
 * One roster entry. `terminalId` is the underlying PTY session, so the existing Terminal
 * attach/stream path renders this server's output without a second stream protocol.
 * `detectedUrl` is best-effort output parsing — absent is normal, wrong is not: it only ever
 * holds an http(s) URL the process itself printed.
 */
export const devServerSchema = z
  .object({
    id: z.string().min(1),
    target: devServerTargetSchema,
    label: z.string().min(1),
    command: z.string().min(1),
    cwd: z.string().min(1),
    status: devServerStatusSchema,
    exitCode: z.number().int().optional(),
    detectedUrl: z.string().url().optional(),
    terminalId: z.string().min(1),
    createdAt: z.number(),
    startedAt: z.number(),
    endedAt: z.number().optional(),
  })
  .strict()
export type DevServer = z.infer<typeof devServerSchema>

/** Roster read. The optional filter narrows to one Worktree; absent means this whole daemon. */
export const devServersInputSchema = z.object({ target: devServerTargetSchema.optional() }).strict()
export const devServersOutputSchema = z.array(devServerSchema)
export type DevServersInput = z.infer<typeof devServersInputSchema>

export const startDevServerInputSchema = z
  .object({
    target: devServerTargetSchema,
    label: z.string().min(1),
    command: z.string().min(1),
  })
  .strict()
export type StartDevServerInput = z.infer<typeof startDevServerInputSchema>

/** Stop is explicit and idempotent in intent: stopping a stopped record is not an error. */
export const stopDevServerInputSchema = z.object({ id: z.string().min(1) }).strict()
export type StopDevServerInput = z.infer<typeof stopDevServerInputSchema>

/** Dismiss forgets a finished record. A running server must be stopped first. */
export const dismissDevServerInputSchema = z.object({ id: z.string().min(1) }).strict()
export const dismissDevServerOutputSchema = z.void()
export type DismissDevServerInput = z.infer<typeof dismissDevServerInputSchema>

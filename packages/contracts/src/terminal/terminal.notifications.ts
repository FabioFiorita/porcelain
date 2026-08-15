import { z } from 'zod'

/**
 * Terminal change notifications.
 *
 * The PTY byte stream is NOT modelled here — it is an ordered stream with its own
 * sequence/lifecycle rules. What belongs on the session channel is the freshness signal for
 * the Terminal domain's *data*: the development-server roster for one Worktree changed
 * (started, went live, printed its URL, exited, was stopped, was dismissed).
 *
 * One strict category carrying the Project + Worktree identity is the whole signal; the
 * client refetches `devServers` for that target rather than merging an entity payload.
 */

export const TERMINAL_CHANGE_KINDS = ['terminal.dev-servers-changed'] as const

export const devServersChangedSchema = z
  .object({
    kind: z.literal('terminal.dev-servers-changed'),
    /** Routing: sessions are scoped to a checkout, exactly as every other domain change is. */
    projectPath: z.string().min(1),
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
  })
  .strict()
export type DevServersChanged = z.infer<typeof devServersChangedSchema>

export const terminalChangeSchema = z.discriminatedUnion('kind', [devServersChangedSchema])
export type TerminalChange = z.infer<typeof terminalChangeSchema>

/** Representative Terminal change values used by boundary tests and client mocks. */
export const terminalNotificationFixtures = {
  'terminal.dev-servers-changed': {
    kind: 'terminal.dev-servers-changed',
    projectPath: '/synthetic/repo',
    projectId: 'project-1',
    worktreeId: 'worktree-1',
  },
} as const

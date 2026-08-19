import { z } from 'zod'
import { worktreeScriptKindSchema } from '../actions/actions.contract'

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

export const TERMINAL_CHANGE_KINDS = [
  'terminal.dev-servers-changed',
  'terminal.worktree-script-started',
] as const

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

/**
 * The daemon just spawned a Worktree lifecycle script and the human is meant to watch it.
 *
 * Setup and dispose scripts are the one case where Porcelain runs a saved command without a
 * click, so the session must not be hidden: this pushes the new session's id the moment it
 * exists, before `createHubWorktree` resolves and — for dispose — before the checkout is
 * removed. Clients refetch the roster and focus `terminalId`; a client that ignores it just
 * sees the session on the next poll.
 */
export const worktreeScriptStartedSchema = z
  .object({
    kind: z.literal('terminal.worktree-script-started'),
    role: worktreeScriptKindSchema,
    /** The checkout the script runs in — the terminal's cwd. */
    projectPath: z.string().min(1),
    projectId: z.string().min(1),
    worktreeId: z.string().min(1),
    terminalId: z.string().min(1),
  })
  .strict()
export type WorktreeScriptStarted = z.infer<typeof worktreeScriptStartedSchema>

export const terminalChangeSchema = z.discriminatedUnion('kind', [
  devServersChangedSchema,
  worktreeScriptStartedSchema,
])
export type TerminalChange = z.infer<typeof terminalChangeSchema>

/** Representative Terminal change values used by boundary tests and client mocks. */
export const terminalNotificationFixtures = {
  'terminal.dev-servers-changed': {
    kind: 'terminal.dev-servers-changed',
    projectPath: '/synthetic/repo',
    projectId: 'project-1',
    worktreeId: 'worktree-1',
  },
  'terminal.worktree-script-started': {
    kind: 'terminal.worktree-script-started',
    role: 'worktree-setup',
    projectPath: '/synthetic/repo',
    projectId: 'project-1',
    worktreeId: 'worktree-1',
    terminalId: 'terminal-1',
  },
} as const

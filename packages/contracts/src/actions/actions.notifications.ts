import { z } from 'zod'

/**
 * Actions change notifications — the domain-owned replacement for the `actions` entry in
 * `appEventSchema` (the deleted horizontal session protocol), which today broadcasts to every session.
 *
 * Saved Actions belong to a stable Project record in the daemon's own store (ADR 0002), so
 * one strict category carrying `projectId` is the whole signal: the saved commands for that
 * Project are stale. A checkout path would name a Worktree, and a Project has many. Machine-local
 * trust is not on the wire here — it is answered by the `actions` query the client refetches.
 */

export const ACTIONS_CHANGE_KINDS = ['actions.changed'] as const

export const actionsChangedSchema = z
  .object({
    kind: z.literal('actions.changed'),
    projectId: z.string().min(1),
  })
  .strict()
export type ActionsChanged = z.infer<typeof actionsChangedSchema>

export const actionsChangeSchema = z.discriminatedUnion('kind', [actionsChangedSchema])
export type ActionsChange = z.infer<typeof actionsChangeSchema>

/** Representative Actions change values used by boundary tests and client mocks. */
export const actionsNotificationFixtures = {
  'actions.changed': {
    kind: 'actions.changed',
    projectId: 'proj-alpha',
  },
} as const

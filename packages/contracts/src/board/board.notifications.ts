import { z } from 'zod'

/**
 * Board change notifications — the domain-owned replacement for the `board` entry in
 * `appEventSchema` (the deleted horizontal session protocol), which today broadcasts to every session.
 *
 * The board is one repo-local file, so one strict category carrying `projectPath` says
 * everything a consumer needs: the cards for that project are stale. The card payload
 * itself stays with the list query, which remains authoritative.
 *
 * RT-001 owns this envelope (`kind: 'board.changed'`). BRD-001 reuses it without a second
 * notification name or dual discriminator.
 */

export const BOARD_CHANGE_KINDS = ['board.changed'] as const

export const boardChangedSchema = z
  .object({
    kind: z.literal('board.changed'),
    projectPath: z.string().min(1),
  })
  .strict()
export type BoardChanged = z.infer<typeof boardChangedSchema>

export const boardChangeSchema = z.discriminatedUnion('kind', [boardChangedSchema])
export type BoardChange = z.infer<typeof boardChangeSchema>

/** Representative Board change values used by boundary tests and client mocks. */
export const boardNotificationFixtures = {
  'board.changed': {
    kind: 'board.changed',
    projectPath: '/synthetic/repo',
  },
} as const

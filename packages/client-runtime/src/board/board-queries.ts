import { type BoardProjectPath, boardProjectPathSchema } from '@porcelain/contracts/board'
import { z } from 'zod'

/**
 * Typed Board cards query identity (BRD-003).
 *
 * Adapters compose this with daemon/environment identity into a TanStack Query key.
 * It is the only Board server-state identity; procedure names and cache strings stay out.
 *
 * The strict schema is what adapters parse a generic `unknown[]` cache key against;
 * `projectPath` reuses the canonical wire `boardProjectPathSchema` rather than a local
 * `string`, so a key carrying an empty or over-long Project path is not a cards identity.
 */

export const boardCardsQuerySchema = z
  .object({
    domain: z.literal('board'),
    name: z.literal('cards'),
    projectPath: boardProjectPathSchema,
  })
  .strict()

export type BoardCardsQuery = Readonly<z.infer<typeof boardCardsQuerySchema>>

/** Build the sole Board cards query identity for a Project path. */
export function boardCardsQuery(projectPath: BoardProjectPath): BoardCardsQuery {
  return { domain: 'board', name: 'cards', projectPath }
}

import { z } from 'zod'

/**
 * Typed Review-comments query identity (RVC-002).
 *
 * Adapters compose this with daemon/environment identity into a TanStack Query key.
 * It is the only Review-comments server-state identity; procedure names and cache
 * strings stay out. Wire inputs still use `repoPath`; this identity uses product
 * language `projectPath`.
 *
 * The strict schema is what adapters parse a generic `unknown[]` cache key against.
 * `projectPath` stays an unconstrained string: the constructor validates nothing today
 * and an identity must never fail the schema its own constructor produced.
 */

export const reviewCommentsQuerySchema = z
  .object({
    domain: z.literal('review'),
    name: z.literal('comments'),
    projectPath: z.string(),
  })
  .strict()

export type ReviewCommentsQuery = Readonly<z.infer<typeof reviewCommentsQuerySchema>>

/** Build the sole Review-comments query identity for a Project path. */
export function reviewCommentsQuery(projectPath: string): ReviewCommentsQuery {
  return { domain: 'review', name: 'comments', projectPath }
}

import { z } from 'zod'

/**
 * Typed Actions list and trust query identities (ACT-002).
 *
 * Machine trust is product-distinct from the saved-action roster, but the only Actions
 * read procedure remains flat `actions`. Both identities exist so notification and mutation
 * consequences can name both slots; adapters may collapse them onto one cache key until a
 * separate trust read exists.
 *
 * The project dimension is the stable Project id the owning daemon minted (ADR 0002), not a
 * checkout path: one Project has many Worktrees and they all share one saved-command roster.
 * An empty id is a programmer error (`ActionsIdentityError`), not a public Actions error code.
 */

/** Programmer error for an invalid Actions project identity. */
export class ActionsIdentityError extends Error {
  override readonly name = 'ActionsIdentityError'
}

const projectIdSchema = z.string().min(1)

/** Normalize the project dimension shared by every Actions identity. */
export function actionsProjectKey(projectId: string): string {
  const parsed = projectIdSchema.safeParse(projectId)
  if (!parsed.success) {
    throw new ActionsIdentityError('actions: project id must be non-empty')
  }
  return parsed.data
}

export const actionsQuerySchema = z
  .object({
    domain: z.literal('actions'),
    name: z.literal('list'),
    projectId: projectIdSchema,
  })
  .strict()

export const actionTrustQuerySchema = z
  .object({
    domain: z.literal('actions'),
    name: z.literal('trust'),
    projectId: projectIdSchema,
  })
  .strict()

/** Any Actions server-state identity, discriminated by `name`. */
export const actionsIdentitySchema = z.discriminatedUnion('name', [
  actionsQuerySchema,
  actionTrustQuerySchema,
])

export type ActionsQuery = Readonly<z.infer<typeof actionsQuerySchema>>
export type ActionTrustQuery = Readonly<z.infer<typeof actionTrustQuerySchema>>
export type ActionsIdentity = Readonly<z.infer<typeof actionsIdentitySchema>>

/** Build the Actions list query identity for a Project id. */
export function actionsQuery(projectId: string): ActionsQuery {
  return {
    domain: 'actions',
    name: 'list',
    projectId: actionsProjectKey(projectId),
  }
}

/** Build the Actions trust query identity for a Project id. */
export function actionTrustQuery(projectId: string): ActionTrustQuery {
  return {
    domain: 'actions',
    name: 'trust',
    projectId: actionsProjectKey(projectId),
  }
}

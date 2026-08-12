import { z } from 'zod'

/**
 * Typed Actions list and trust query identities (ACT-002).
 *
 * Machine trust is product-distinct from the saved-action roster, but the only Actions
 * read procedure remains flat `actions`. Both identities exist so notification and mutation
 * consequences can name both slots; adapters may collapse them onto one cache key until a
 * separate trust read exists.
 *
 * No absolute-path, host, or trailing-slash policy — Actions wire has none. Empty path is a
 * programmer error (`ActionsIdentityError`), not a public Actions error code.
 */

/** Programmer error for an invalid Actions project identity. */
export class ActionsIdentityError extends Error {
  override readonly name = 'ActionsIdentityError'
}

const projectPathSchema = z.string().min(1)

/** Normalize the project dimension shared by every Actions identity. */
export function actionsProjectKey(projectPath: string): string {
  const parsed = projectPathSchema.safeParse(projectPath)
  if (!parsed.success) {
    throw new ActionsIdentityError('actions: project path must be non-empty')
  }
  return parsed.data
}

export const actionsQuerySchema = z
  .object({
    domain: z.literal('actions'),
    name: z.literal('list'),
    projectPath: projectPathSchema,
  })
  .strict()

export const actionTrustQuerySchema = z
  .object({
    domain: z.literal('actions'),
    name: z.literal('trust'),
    projectPath: projectPathSchema,
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

/** Build the Actions list query identity for a Project path. */
export function actionsQuery(projectPath: string): ActionsQuery {
  return {
    domain: 'actions',
    name: 'list',
    projectPath: actionsProjectKey(projectPath),
  }
}

/** Build the Actions trust query identity for a Project path. */
export function actionTrustQuery(projectPath: string): ActionTrustQuery {
  return {
    domain: 'actions',
    name: 'trust',
    projectPath: actionsProjectKey(projectPath),
  }
}

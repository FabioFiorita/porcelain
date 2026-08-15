import { z } from 'zod'

/**
 * Typed Tasks query identity.
 *
 * The table is daemon-wide, so the identity carries no Project path — but it DOES carry the
 * Environment it was read from, because the Hub shows several daemons' tables at once and two
 * Environments' rows must never share a cache entry. Adapters compose this with their own
 * daemon scope into a TanStack Query key.
 *
 * `environmentId` is `null` for the Environment the client is directly connected to (the
 * browser case, where there is exactly one and it has no Hub-assigned id yet).
 */

export const tasksTableQuerySchema = z
  .object({
    domain: z.literal('tasks'),
    name: z.literal('table'),
    environmentId: z.string().min(1).nullable(),
  })
  .strict()

export type TasksTableQuery = Readonly<z.infer<typeof tasksTableQuerySchema>>

/** Build the sole Tasks table query identity for one Environment. */
export function tasksTableQuery(environmentId: string | null = null): TasksTableQuery {
  return { domain: 'tasks', name: 'table', environmentId }
}

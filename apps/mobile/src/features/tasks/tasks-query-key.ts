import {
  type TasksTableQuery,
  tasksTableQuery,
  tasksTableQuerySchema,
} from '@porcelain/client-runtime/tasks'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

/**
 * Mobile React Query keys for the Tasks table.
 *
 * `['daemon', environmentId, identity]` is the shape every mobile domain uses, and the shared
 * identity carries the Environment a second time on purpose: the prefix is what the mobile
 * cache is swept by, the identity is what `tasksMutations`/`tasksNotificationEffects` hand
 * back. Deriving the prefix from the identity keeps the two from ever disagreeing.
 *
 * A phone has no local daemon, so the identity's `null` Environment — the browser client's
 * directly-connected case — cannot occur here and is refused rather than collapsed onto a
 * shared key that two daemons would then both write.
 */

const tasksKeySchema = z.tuple([z.literal('daemon'), z.string().min(1), tasksTableQuerySchema])

export type TasksTableKey = readonly ['daemon', string, TasksTableQuery]

/** The key an identity is cached under. Returns null for the impossible `null` Environment. */
export function tasksTableKeyFor(identity: TasksTableQuery): TasksTableKey | null {
  if (identity.environmentId === null) return null
  return ['daemon', identity.environmentId, identity] as const
}

/** One paired Environment's table key. */
export function tasksTableKey(environmentId: string): TasksTableKey {
  return ['daemon', environmentId, tasksTableQuery(environmentId)] as const
}

export function isTasksTableQueryKey(queryKey: readonly unknown[]): boolean {
  return tasksKeySchema.safeParse(queryKey).success
}

/** Invalidate exactly the tables a mutation or notification made stale. */
export function invalidateTasksIdentities(
  queryClient: QueryClient,
  identities: readonly TasksTableQuery[],
): Promise<void> {
  const keys = identities.flatMap((identity) => {
    const key = tasksTableKeyFor(identity)
    return key === null ? [] : [key]
  })
  return Promise.all(
    keys.map(async (queryKey) => queryClient.invalidateQueries({ queryKey, exact: true })),
  ).then(() => undefined)
}

/**
 * Invalidate every Environment's table. Session recovery calls this: after a gap nothing this
 * client holds about ANY daemon's table is proven, and one socket's notification cannot speak
 * for the Environments it is not connected to.
 */
export function invalidateAllTasksQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => isTasksTableQueryKey(query.queryKey),
  })
}

/**
 * One attachment's bytes, keyed by the Task that owns it.
 *
 * Deliberately outside `isTasksTableQueryKey`: an attachment id names immutable bytes the
 * daemon already copied into its store, so a `tasks.changed` sweep of the tables has no reason
 * to throw the pictures away and refetch them.
 */
export function taskAttachmentKey(
  environmentId: string,
  taskId: string,
  attachmentId: string,
): readonly [
  'daemon',
  string,
  { domain: 'tasks'; name: 'attachment'; taskId: string; attachmentId: string },
] {
  return [
    'daemon',
    environmentId,
    { domain: 'tasks', name: 'attachment', taskId, attachmentId },
  ] as const
}

import {
  type BoardCardsQuery,
  boardCardsQuery,
  boardCardsQuerySchema,
} from '@porcelain/client-runtime/board'
import { type DaemonScope, daemonScopeSchema } from '@renderer/lib/daemon-scope'
import { z } from 'zod'

/**
 * Web React Query key for Board cards: BRD-003 identity + active daemon scope.
 * The only Board server-state key; procedure-name strings never appear here.
 */

/** The exact two-element key shape, parsed rather than pattern-matched. */
const boardCardsQueryKeySchema = z.tuple([boardCardsQuerySchema, daemonScopeSchema])

/** Compose the exact React Query key for one Project's Board cards on one daemon. */
export function boardCardsQueryKey(
  daemon: DaemonScope,
  cardsQuery: BoardCardsQuery,
): readonly [BoardCardsQuery, DaemonScope] {
  return [cardsQuery, { host: daemon.host, version: daemon.version }] as const
}

/** Build the cards key for a Project path under the active daemon scope. */
export function boardCardsKeyForProject(
  daemon: DaemonScope,
  projectPath: string,
): readonly [BoardCardsQuery, DaemonScope] {
  return boardCardsQueryKey(daemon, boardCardsQuery(projectPath))
}

/** True when a React Query key is a Board cards identity (any Project / daemon). */
export function isBoardCardsQueryKey(queryKey: readonly unknown[]): boolean {
  return boardCardsQueryKeySchema.safeParse(queryKey).success
}

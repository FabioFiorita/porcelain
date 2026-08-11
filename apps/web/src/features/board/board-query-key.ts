import { type BoardCardsQuery, boardCardsQuery } from '@porcelain/client-runtime/board'

/**
 * Web React Query key for Board cards: BRD-003 identity + active daemon scope.
 * The only Board server-state key; procedure-name strings never appear here.
 */

export type BoardDaemonScope = {
  readonly host: string | null
  readonly version: string | null
}

/** Compose the exact React Query key for one Project's Board cards on one daemon. */
export function boardCardsQueryKey(
  daemon: BoardDaemonScope,
  cardsQuery: BoardCardsQuery,
): readonly [BoardCardsQuery, BoardDaemonScope] {
  return [cardsQuery, { host: daemon.host, version: daemon.version }] as const
}

/** Build the cards key for a Project path under the active daemon scope. */
export function boardCardsKeyForProject(
  daemon: BoardDaemonScope,
  projectPath: string,
): readonly [BoardCardsQuery, BoardDaemonScope] {
  return boardCardsQueryKey(daemon, boardCardsQuery(projectPath))
}

/** True when a React Query key is a Board cards identity (any Project / daemon). */
export function isBoardCardsQueryKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0]
  return (
    typeof head === 'object' &&
    head !== null &&
    'domain' in head &&
    (head as { domain: unknown }).domain === 'board' &&
    'name' in head &&
    (head as { name: unknown }).name === 'cards'
  )
}

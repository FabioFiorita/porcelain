import { type BoardCardsQuery, boardCardsQuery } from '@porcelain/client-runtime/board'

/**
 * Mobile React Query key for Board cards: BRD-003 identity + active environment id.
 * The only Board server-state key; procedure-name strings never appear here.
 */

/** Compose the exact React Query key for one Project's Board cards on one environment. */
export function boardCardsQueryKey(
  environmentId: string,
  projectPath: string,
): readonly ['daemon', string, BoardCardsQuery] {
  return ['daemon', environmentId, boardCardsQuery(projectPath)] as const
}

/** Build the cards key from a BRD-003 identity (notification effects). */
export function boardCardsQueryKeyForIdentity(
  environmentId: string,
  identity: BoardCardsQuery,
): readonly ['daemon', string, BoardCardsQuery] {
  return ['daemon', environmentId, identity] as const
}

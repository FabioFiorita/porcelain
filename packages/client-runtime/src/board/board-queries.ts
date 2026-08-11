import type { BoardProjectPath } from '@porcelain/contracts/board'

/**
 * Typed Board cards query identity (BRD-003).
 *
 * Adapters compose this with daemon/environment identity into a TanStack Query key.
 * It is the only Board server-state identity; procedure names and cache strings stay out.
 */

export type BoardCardsQuery = {
  readonly domain: 'board'
  readonly name: 'cards'
  readonly projectPath: BoardProjectPath
}

/** Build the sole Board cards query identity for a Project path. */
export function boardCardsQuery(projectPath: BoardProjectPath): BoardCardsQuery {
  return { domain: 'board', name: 'cards', projectPath }
}

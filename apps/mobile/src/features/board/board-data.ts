/**
 * Mobile Board feature public data surface (BRD-005).
 *
 * Re-exports columns, query keys, and hooks. Daemon transport lives in the `use-board-*`
 * modules (Biome's mobile client-import exemption), matching the feature-boundary idiom.
 */

export { BOARD_COLUMNS, boardStatusLabel, cardsInColumn } from './board-columns'
export { boardCardsQueryKey } from './board-query-key'
export type { CardActions } from './use-board-actions'
export { useBoardCardActions } from './use-board-actions'
export type { BoardCards } from './use-board-cards'
export {
  useBoardCards,
  useBoardFailure,
  useBoardProjectPath,
  useFocusCard,
  useSelectedCardId,
} from './use-board-cards'

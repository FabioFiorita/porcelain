/**
 * Web Board feature public entry point (BRD-004).
 *
 * Other Web regions import this module only — never a Board implementation file.
 */

export { BOARD_COLUMNS, type BoardStatus, boardStatusLabel } from './board-columns'
export { BoardList } from './board-list'
export { type NewCardInput, useBoardCardActions } from './board-mutations'
export {
  applyBoardNotification,
  invalidateAllBoardCards,
  useBoardNotificationSubscription,
} from './board-notifications'
export { type BoardCardsView, useBoardCards } from './board-queries'
export { BoardQuickAccess } from './board-quick-access'
export { resolveBoardFocus, useBoardSelectionStore } from './board-selection-store'
export { BoardView } from './board-view'
export { CardComposer } from './card-composer'
export { type CardDraft, draftFromCard, useCardDraftStore } from './card-draft-store'
export { CardItem } from './card-item'
export { ClearColumnButton } from './clear-column-button'

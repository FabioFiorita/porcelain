/**
 * Shared Board client semantics (BRD-003).
 *
 * Framework-neutral query identity, mutation consequences, pure optimistic transitions,
 * and `board.changed` notification mapping. Web and mobile adapters bind these definitions
 * to their transport and TanStack Query layers (BRD-004, BRD-005).
 */

export {
  type BoardMutation,
  type BoardMutationDefinition,
  boardMutations,
} from './board-mutations'
export { boardNotificationEffects } from './board-notifications'
export {
  type BoardCardsQuery,
  boardCardsQuery,
} from './board-queries'
export {
  applyBoardOptimisticTransition,
  type BoardMutationKey,
  type BoardOptimisticContext,
  type BoardOptimisticSnapshot,
  type BoardOptimisticTransitionResult,
  reconcileBoardMutation,
  rollbackBoardOptimisticTransition,
} from './board-reconciliation'

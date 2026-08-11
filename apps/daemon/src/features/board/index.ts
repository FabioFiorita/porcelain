/**
 * Board domain public surface for daemon composition.
 * Only the bound router is exported; operations are constructed at the composition root.
 */

export {
  type BoardOperations,
  createBoardOperations,
} from './board-operations'
export { createBoardRouter } from './board-router'

import type { ProcedureContract } from '../procedure-contract'
import {
  clearBoardColumnInputSchema,
  clearBoardColumnOutputSchema,
  createBoardCardInputSchema,
  createBoardCardOutputSchema,
  deleteBoardCardInputSchema,
  deleteBoardCardOutputSchema,
  listBoardCardsInputSchema,
  listBoardCardsOutputSchema,
  moveBoardCardInputSchema,
  moveBoardCardOutputSchema,
  updateBoardCardInputSchema,
  updateBoardCardOutputSchema,
} from './board.contract'

/**
 * Canonical Board procedure declarations (BRD-001).
 *
 * These six names are the public Board wire vocabulary and the live catalog members
 * composed into `procedureCatalog` (BRD-004 six-for-six swap). Inline `name: { kind }`
 * entries keep the procedure-contract lint's domain-record scanner honest.
 */

export const boardProcedures = {
  listBoardCards: {
    kind: 'query',
    input: listBoardCardsInputSchema,
    output: listBoardCardsOutputSchema,
    errors: ['board.unavailable'],
  },
  createBoardCard: {
    kind: 'mutation',
    input: createBoardCardInputSchema,
    output: createBoardCardOutputSchema,
    errors: ['board.unavailable', 'board.invalid-title'],
  },
  updateBoardCard: {
    kind: 'mutation',
    input: updateBoardCardInputSchema,
    output: updateBoardCardOutputSchema,
    errors: ['board.unavailable', 'board.card-not-found', 'board.invalid-title'],
  },
  moveBoardCard: {
    kind: 'mutation',
    input: moveBoardCardInputSchema,
    output: moveBoardCardOutputSchema,
    errors: ['board.unavailable', 'board.card-not-found'],
  },
  deleteBoardCard: {
    kind: 'mutation',
    input: deleteBoardCardInputSchema,
    output: deleteBoardCardOutputSchema,
    errors: ['board.unavailable', 'board.card-not-found'],
  },
  clearBoardColumn: {
    kind: 'mutation',
    input: clearBoardColumnInputSchema,
    output: clearBoardColumnOutputSchema,
    errors: ['board.unavailable'],
  },
} as const satisfies Record<string, ProcedureContract>

export type BoardProcedureName = keyof typeof boardProcedures

export const listBoardCardsProcedure = boardProcedures.listBoardCards
export const createBoardCardProcedure = boardProcedures.createBoardCard
export const updateBoardCardProcedure = boardProcedures.updateBoardCard
export const moveBoardCardProcedure = boardProcedures.moveBoardCard
export const deleteBoardCardProcedure = boardProcedures.deleteBoardCard
export const clearBoardColumnProcedure = boardProcedures.clearBoardColumn

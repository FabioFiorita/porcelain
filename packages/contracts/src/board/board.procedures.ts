import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
import {
  addBoardCardInputSchema,
  addBoardCardOutputSchema,
  boardCardsInputSchema,
  boardCardsOutputSchema,
  clearBoardCardsInputSchema,
  clearBoardCardsOutputSchema,
  deleteBoardCardInputSchema,
  deleteBoardCardOutputSchema,
  moveBoardCardInputSchema,
  moveBoardCardOutputSchema,
  updateBoardCardInputSchema,
  updateBoardCardOutputSchema,
} from './board.contract'

const boardProcedureDefinitions = {
  boardCards: {
    kind: 'query',
    input: boardCardsInputSchema,
    output: boardCardsOutputSchema,
  },
  addBoardCard: {
    kind: 'mutation',
    input: addBoardCardInputSchema,
    output: addBoardCardOutputSchema,
  },
  updateBoardCard: {
    kind: 'mutation',
    input: updateBoardCardInputSchema,
    output: updateBoardCardOutputSchema,
  },
  moveBoardCard: {
    kind: 'mutation',
    input: moveBoardCardInputSchema,
    output: moveBoardCardOutputSchema,
  },
  deleteBoardCard: {
    kind: 'mutation',
    input: deleteBoardCardInputSchema,
    output: deleteBoardCardOutputSchema,
  },
  clearBoardCards: {
    kind: 'mutation',
    input: clearBoardCardsInputSchema,
    output: clearBoardCardsOutputSchema,
  },
} as const

export type BoardProcedureName = Extract<keyof typeof boardProcedureDefinitions, ProcedureName>

export const boardProcedures = boardProcedureDefinitions satisfies Record<
  BoardProcedureName,
  ProcedureContract
>

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
    errors: [],
  },
  addBoardCard: {
    kind: 'mutation',
    input: addBoardCardInputSchema,
    output: addBoardCardOutputSchema,
    errors: [],
  },
  updateBoardCard: {
    kind: 'mutation',
    input: updateBoardCardInputSchema,
    output: updateBoardCardOutputSchema,
    errors: [],
  },
  moveBoardCard: {
    kind: 'mutation',
    input: moveBoardCardInputSchema,
    output: moveBoardCardOutputSchema,
    errors: [],
  },
  deleteBoardCard: {
    kind: 'mutation',
    input: deleteBoardCardInputSchema,
    output: deleteBoardCardOutputSchema,
    errors: [],
  },
  clearBoardCards: {
    kind: 'mutation',
    input: clearBoardCardsInputSchema,
    output: clearBoardCardsOutputSchema,
    errors: [],
  },
} as const

export type BoardProcedureName = Extract<keyof typeof boardProcedureDefinitions, ProcedureName>

export const boardProcedures = boardProcedureDefinitions satisfies Record<
  BoardProcedureName,
  ProcedureContract
>

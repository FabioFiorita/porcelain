import { z } from 'zod'
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
 * These six names are the public Board wire vocabulary. They are intentionally **not** members of
 * `procedureCatalog` in this unit: the permanent 113-procedure 1:1 gate stays green on the live
 * legacy names below until BRD-002 swaps six-for-six with the daemon router cutover.
 *
 * Defined as top-level consts so the procedure-contract lint (which matches `name: { kind: ... }`
 * object entries) continues to see only the live catalog block for the 113-count.
 */

export const listBoardCardsProcedure = {
  kind: 'query',
  input: listBoardCardsInputSchema,
  output: listBoardCardsOutputSchema,
  errors: ['board.unavailable'],
} as const satisfies ProcedureContract

export const createBoardCardProcedure = {
  kind: 'mutation',
  input: createBoardCardInputSchema,
  output: createBoardCardOutputSchema,
  errors: ['board.unavailable', 'board.invalid-title'],
} as const satisfies ProcedureContract

export const updateBoardCardProcedure = {
  kind: 'mutation',
  input: updateBoardCardInputSchema,
  output: updateBoardCardOutputSchema,
  errors: ['board.unavailable', 'board.card-not-found', 'board.invalid-title'],
} as const satisfies ProcedureContract

export const moveBoardCardProcedure = {
  kind: 'mutation',
  input: moveBoardCardInputSchema,
  output: moveBoardCardOutputSchema,
  errors: ['board.unavailable', 'board.card-not-found'],
} as const satisfies ProcedureContract

export const deleteBoardCardProcedure = {
  kind: 'mutation',
  input: deleteBoardCardInputSchema,
  output: deleteBoardCardOutputSchema,
  errors: ['board.unavailable', 'board.card-not-found'],
} as const satisfies ProcedureContract

export const clearBoardColumnProcedure = {
  kind: 'mutation',
  input: clearBoardColumnInputSchema,
  output: clearBoardColumnOutputSchema,
  errors: ['board.unavailable'],
} as const satisfies ProcedureContract

export const boardProcedures = {
  listBoardCards: listBoardCardsProcedure,
  createBoardCard: createBoardCardProcedure,
  updateBoardCard: updateBoardCardProcedure,
  moveBoardCard: moveBoardCardProcedure,
  deleteBoardCard: deleteBoardCardProcedure,
  clearBoardColumn: clearBoardColumnProcedure,
} as const

export type BoardProcedureName = keyof typeof boardProcedures

/**
 * Live Board catalog members still bound by `apps/daemon/src/features/board/board-router.ts`
 * (legacy wire names) and composed into `procedureCatalog`. BRD-004 performs the six-for-six
 * catalog/name swap with the Web migration.
 *
 * Not part of the public Board boundary (`@porcelain/contracts/board` does not re-export it).
 * Inline legacy schemas preserve current wire shapes (repoPath, void mutations) without aliasing
 * old procedure names onto the canonical declarations above.
 */
const liveBoardCardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string().optional(),
    status: z.enum(['todo', 'doing', 'done']),
    order: z.number(),
    createdAt: z.number(),
  })
  .strict()

const boardLiveCatalogProcedureDefinitions = {
  boardCards: {
    kind: 'query',
    input: z.string(),
    output: z.array(liveBoardCardSchema),
    errors: [],
  },
  addBoardCard: {
    kind: 'mutation',
    input: z
      .object({
        repoPath: z.string(),
        title: z.string().min(1),
        body: z.string().optional(),
        status: z.enum(['todo', 'doing', 'done']).optional(),
      })
      .strict(),
    output: liveBoardCardSchema,
    errors: [],
  },
  updateBoardCard: {
    kind: 'mutation',
    input: z
      .object({
        repoPath: z.string(),
        id: z.string(),
        title: z.string().min(1).optional(),
        body: z.string().optional(),
      })
      .strict(),
    output: z.void(),
    errors: [],
  },
  moveBoardCard: {
    kind: 'mutation',
    input: z
      .object({
        repoPath: z.string(),
        id: z.string(),
        status: z.enum(['todo', 'doing', 'done']),
      })
      .strict(),
    output: z.void(),
    errors: [],
  },
  deleteBoardCard: {
    kind: 'mutation',
    input: z
      .object({
        repoPath: z.string(),
        id: z.string(),
      })
      .strict(),
    output: z.void(),
    errors: [],
  },
  clearBoardCards: {
    kind: 'mutation',
    input: z
      .object({
        repoPath: z.string(),
        status: z.enum(['todo', 'doing', 'done']),
      })
      .strict(),
    output: z.void(),
    errors: [],
  },
} as const

export const boardLiveCatalogProcedures = boardLiveCatalogProcedureDefinitions satisfies Record<
  keyof typeof boardLiveCatalogProcedureDefinitions,
  ProcedureContract
>

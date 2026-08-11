import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { BoardOperationResult } from './board-capabilities'
import type { BoardOperations } from './board-operations'

/**
 * Board feature router — six EXISTING legacy wire names bound to boardLiveCatalogProcedures.
 * Each procedure is parse → invoke one operation → map. BRD-004 performs the six-for-six
 * catalog/name swap to listBoardCards…clearBoardColumn with the Web migration.
 */

function throwIfFailed<T>(result: BoardOperationResult<T>): T {
  if (result.ok) return result.value
  const error = result.error
  if (error.code === 'board.card-not-found') {
    throw toTrpcError(expectedFailure('board.card-not-found', { cardId: error.cardId }))
  }
  if (error.code === 'board.invalid-title') {
    throw toTrpcError(
      expectedFailure('board.invalid-title', {
        reason: error.reason,
        maxLength: error.maxLength,
      }),
    )
  }
  throw toTrpcError(expectedFailure('board.unavailable'))
}

export function createBoardRouter(operations: BoardOperations) {
  return t.router({
    boardCards: publicProcedure
      .input(procedureCatalog.boardCards.input)
      .output(procedureCatalog.boardCards.output)
      .query(async ({ input }) => {
        const result = await operations.listBoardCards({ projectPath: input })
        return throwIfFailed(result)
      }),

    addBoardCard: publicProcedure
      .input(procedureCatalog.addBoardCard.input)
      .output(procedureCatalog.addBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.createBoardCard({
          projectPath: input.repoPath,
          title: input.title,
          body: input.body,
          status: input.status,
        })
        return throwIfFailed(result)
      }),

    updateBoardCard: publicProcedure
      .input(procedureCatalog.updateBoardCard.input)
      .output(procedureCatalog.updateBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.updateBoardCard({
          projectPath: input.repoPath,
          cardId: input.id,
          title: input.title,
          body: input.body,
        })
        throwIfFailed(result)
        // Legacy wire keeps void mutation outputs until BRD-004.
      }),

    moveBoardCard: publicProcedure
      .input(procedureCatalog.moveBoardCard.input)
      .output(procedureCatalog.moveBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.moveBoardCard({
          projectPath: input.repoPath,
          cardId: input.id,
          status: input.status,
        })
        throwIfFailed(result)
      }),

    deleteBoardCard: publicProcedure
      .input(procedureCatalog.deleteBoardCard.input)
      .output(procedureCatalog.deleteBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.deleteBoardCard({
          projectPath: input.repoPath,
          cardId: input.id,
        })
        throwIfFailed(result)
      }),

    clearBoardCards: publicProcedure
      .input(procedureCatalog.clearBoardCards.input)
      .output(procedureCatalog.clearBoardCards.output)
      .mutation(async ({ input }) => {
        const result = await operations.clearBoardColumn({
          projectPath: input.repoPath,
          status: input.status,
        })
        throwIfFailed(result)
      }),
  })
}

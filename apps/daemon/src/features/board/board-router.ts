import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { BoardOperationResult } from './board-capabilities'
import type { BoardOperations } from './board-operations'

/**
 * Board feature router — six canonical BRD-001 wire names bound to boardProcedures.
 * Each procedure is parse → invoke one operation → map authoritative outputs.
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
    listBoardCards: publicProcedure
      .input(procedureCatalog.listBoardCards.input)
      .output(procedureCatalog.listBoardCards.output)
      .query(async ({ input }) => {
        const result = await operations.listBoardCards({ projectPath: input })
        return throwIfFailed(result)
      }),

    createBoardCard: publicProcedure
      .input(procedureCatalog.createBoardCard.input)
      .output(procedureCatalog.createBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.createBoardCard({
          projectPath: input.projectPath,
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
          projectPath: input.projectPath,
          cardId: input.cardId,
          title: input.title,
          body: input.body,
        })
        return throwIfFailed(result)
      }),

    moveBoardCard: publicProcedure
      .input(procedureCatalog.moveBoardCard.input)
      .output(procedureCatalog.moveBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.moveBoardCard({
          projectPath: input.projectPath,
          cardId: input.cardId,
          status: input.status,
        })
        return throwIfFailed(result)
      }),

    deleteBoardCard: publicProcedure
      .input(procedureCatalog.deleteBoardCard.input)
      .output(procedureCatalog.deleteBoardCard.output)
      .mutation(async ({ input }) => {
        const result = await operations.deleteBoardCard({
          projectPath: input.projectPath,
          cardId: input.cardId,
        })
        return throwIfFailed(result)
      }),

    clearBoardColumn: publicProcedure
      .input(procedureCatalog.clearBoardColumn.input)
      .output(procedureCatalog.clearBoardColumn.output)
      .mutation(async ({ input }) => {
        const result = await operations.clearBoardColumn({
          projectPath: input.projectPath,
          status: input.status,
        })
        return throwIfFailed(result)
      }),
  })
}

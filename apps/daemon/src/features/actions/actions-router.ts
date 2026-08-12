import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { ActionsOperations } from './actions-operations'
import type { ActionsOperationResult } from './actions-ports'

/**
 * Actions feature router — six flat wire names bound to actionsProcedures.
 * Each procedure is parse → invoke one operation → map authoritative outputs.
 */

function throwIfFailed<T>(result: ActionsOperationResult<T>): T {
  if (result.ok) return result.value
  const error = result.error
  if (error.code === 'actions.not-found') {
    throw toTrpcError(expectedFailure('actions.not-found', { actionId: error.actionId }))
  }
  if (error.code === 'actions.untrusted') {
    throw toTrpcError(expectedFailure('actions.untrusted', { actionId: error.actionId }))
  }
  if (error.code === 'request.invalid') {
    throw toTrpcError(expectedFailure('request.invalid'))
  }
  throw toTrpcError(expectedFailure('actions.unavailable'))
}

export function createActionsRouter(operations: ActionsOperations) {
  return t.router({
    actions: publicProcedure
      .input(procedureCatalog.actions.input)
      .output(procedureCatalog.actions.output)
      .query(async ({ input }) => {
        const result = await operations.listActions({ projectPath: input })
        return throwIfFailed(result)
      }),

    trustActions: publicProcedure
      .input(procedureCatalog.trustActions.input)
      .output(procedureCatalog.trustActions.output)
      .mutation(async ({ input }) => {
        const result = await operations.trustActions({
          projectPath: input.repoPath,
          ids: input.ids,
        })
        throwIfFailed(result)
      }),

    addAction: publicProcedure
      .input(procedureCatalog.addAction.input)
      .output(procedureCatalog.addAction.output)
      .mutation(async ({ input }) => {
        const result = await operations.addAction({
          projectPath: input.repoPath,
          title: input.title,
          command: input.command,
          where: input.where,
        })
        return throwIfFailed(result)
      }),

    updateAction: publicProcedure
      .input(procedureCatalog.updateAction.input)
      .output(procedureCatalog.updateAction.output)
      .mutation(async ({ input }) => {
        const result = await operations.updateAction({
          projectPath: input.repoPath,
          id: input.id,
          title: input.title,
          command: input.command,
          where: input.where,
        })
        throwIfFailed(result)
      }),

    moveAction: publicProcedure
      .input(procedureCatalog.moveAction.input)
      .output(procedureCatalog.moveAction.output)
      .mutation(async ({ input }) => {
        const result = await operations.moveAction({
          projectPath: input.repoPath,
          id: input.id,
          direction: input.direction,
        })
        throwIfFailed(result)
      }),

    deleteAction: publicProcedure
      .input(procedureCatalog.deleteAction.input)
      .output(procedureCatalog.deleteAction.output)
      .mutation(async ({ input }) => {
        const result = await operations.deleteAction({
          projectPath: input.repoPath,
          id: input.id,
        })
        throwIfFailed(result)
      }),
  })
}

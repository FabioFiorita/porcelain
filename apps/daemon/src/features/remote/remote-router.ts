import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { adminProcedure, publicProcedure, t } from '../../trpc'
import type { RemoteOperations } from './remote-operations'
import type { RemoteOperationResult } from './remote-ports'

function throwIfFailed<T>(result: RemoteOperationResult<T>): T {
  if (result.ok) return result.value
  throw toTrpcError(expectedFailure(result.error.code))
}

export function createRemoteRouter(operations: RemoteOperations) {
  return t.router({
    daemonInfo: publicProcedure
      .input(procedureCatalog.daemonInfo.input)
      .output(procedureCatalog.daemonInfo.output)
      .query(() => operations.daemonInfo()),

    checkDaemonUpdate: publicProcedure
      .input(procedureCatalog.checkDaemonUpdate.input)
      .output(procedureCatalog.checkDaemonUpdate.output)
      .mutation(async () => operations.checkDaemonUpdate()),

    restartDaemon: publicProcedure
      .input(procedureCatalog.restartDaemon.input)
      .output(procedureCatalog.restartDaemon.output)
      .mutation(async () => {
        throwIfFailed(await operations.restartDaemon())
      }),

    accessStatus: adminProcedure
      .input(procedureCatalog.accessStatus.input)
      .output(procedureCatalog.accessStatus.output)
      .query(async () => operations.accessStatus()),

    issuePairingLink: adminProcedure
      .input(procedureCatalog.issuePairingLink.input)
      .output(procedureCatalog.issuePairingLink.output)
      .mutation(async ({ input }) => throwIfFailed(await operations.issuePairingLink(input))),

    revokePairingLink: adminProcedure
      .input(procedureCatalog.revokePairingLink.input)
      .output(procedureCatalog.revokePairingLink.output)
      .mutation(async ({ input }) => {
        throwIfFailed(await operations.revokePairingLink(input))
      }),

    revokeAuthorizedClient: adminProcedure
      .input(procedureCatalog.revokeAuthorizedClient.input)
      .output(procedureCatalog.revokeAuthorizedClient.output)
      .mutation(async ({ input }) => {
        throwIfFailed(await operations.revokeAuthorizedClient(input))
      }),

    revokeCurrentClient: publicProcedure
      .input(procedureCatalog.revokeCurrentClient.input)
      .output(procedureCatalog.revokeCurrentClient.output)
      .mutation(async ({ ctx }) => {
        throwIfFailed(await operations.revokeCurrentClient(ctx.auth))
      }),
  })
}

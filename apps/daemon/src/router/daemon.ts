import { PROTOCOL_VERSION, type ProtocolVersion, procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../daemon-composition/expected-failure'
import { toTrpcError } from '../daemon-composition/public-error'
import { displayAdminTokenPath } from '../net/admin-token'
import { type DaemonIdentity, daemonIdentity } from '../net/daemon-identity'
import { daemonVersion } from '../net/daemon-version'
import { clientSessionCount, closeClientSessions } from '../session/live-session'
import {
  accessSnapshot,
  issuePairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from '../stores/access-store'
import { adminProcedure, publicProcedure, t } from '../trpc'

export const daemonRouter = t.router({
  // The current daemon's build version, wire protocol, and identity. One response gives the
  // client the machine label, the exact build serving the rest of the contract, and the
  // protocol it speaks — the shared literal, never derived from the build version.
  daemonInfo: publicProcedure
    .input(procedureCatalog.daemonInfo.input)
    .output(procedureCatalog.daemonInfo.output)
    .query((): { version: string; protocolVersion: ProtocolVersion } & DaemonIdentity => ({
      version: daemonVersion(),
      protocolVersion: PROTOCOL_VERSION,
      ...daemonIdentity(),
    })),

  // Host access administration. These procedures are callable only with the
  // administrator credential held by the local Electron shell / host CLI.
  // Paired devices receive client identities and are rejected by the middleware.
  accessStatus: adminProcedure
    .input(procedureCatalog.accessStatus.input)
    .output(procedureCatalog.accessStatus.output)
    .query(async () => ({
      ...(await accessSnapshot()),
      connected: clientSessionCount(),
      adminTokenPath: displayAdminTokenPath(),
    })),

  issuePairingLink: adminProcedure
    .input(procedureCatalog.issuePairingLink.input)
    .output(procedureCatalog.issuePairingLink.output)
    .mutation(async ({ input }) => {
      const base = new URL(input.baseUrl)
      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        throw toTrpcError(expectedFailure('request.invalid'))
      }
      if (base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '') {
        throw toTrpcError(expectedFailure('request.invalid'))
      }
      base.pathname = '/pair'
      const grant = await issuePairingGrant(input.label)
      base.hash = new URLSearchParams([['token', grant.credential]]).toString()
      return { ...grant, url: base.toString() }
    }),

  revokePairingLink: adminProcedure
    .input(procedureCatalog.revokePairingLink.input)
    .output(procedureCatalog.revokePairingLink.output)
    .mutation(async ({ input }) => {
      await revokePairingGrant(input)
    }),

  revokeAuthorizedClient: adminProcedure
    .input(procedureCatalog.revokeAuthorizedClient.input)
    .output(procedureCatalog.revokeAuthorizedClient.output)
    .mutation(async ({ input }) => {
      if (await revokeAuthorizedClient(input)) closeClientSessions(input)
    }),

  revokeCurrentClient: publicProcedure
    .input(procedureCatalog.revokeCurrentClient.input)
    .output(procedureCatalog.revokeCurrentClient.output)
    .mutation(async ({ ctx }) => {
      if (ctx.auth.kind !== 'client') {
        throw toTrpcError(expectedFailure('auth.forbidden'))
      }
      if (await revokeAuthorizedClient(ctx.auth.clientId)) closeClientSessions(ctx.auth.clientId)
    }),
})

import { z } from 'zod'
import { expectedFailure } from '../daemon-composition/expected-failure'
import { toTrpcError } from '../daemon-composition/public-error'
import { displayAdminTokenPath } from '../net/admin-token'
import { type DaemonIdentity, daemonIdentity } from '../net/daemon-identity'
import { daemonVersion } from '../net/daemon-version'
import { clientSessionCount, closeClientSessions } from '../net/session'
import {
  accessSnapshot,
  issuePairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from '../stores/access-store'
import { adminProcedure, publicProcedure, t } from '../trpc'

export const daemonRouter = t.router({
  // The current daemon's build version and identity. One response gives the client
  // the machine label and the exact build serving the rest of the contract.
  daemonInfo: publicProcedure.query((): { version: string } & DaemonIdentity => ({
    version: daemonVersion(),
    ...daemonIdentity(),
  })),

  // Host access administration. These procedures are callable only with the
  // administrator credential held by the local Electron shell / host CLI.
  // Paired devices receive client identities and are rejected by the middleware.
  accessStatus: adminProcedure.query(async () => ({
    ...(await accessSnapshot()),
    connected: clientSessionCount(),
    adminTokenPath: displayAdminTokenPath(),
  })),

  issuePairingLink: adminProcedure
    .input(
      z.object({
        label: z.string().trim().min(1).max(80),
        baseUrl: z.string().url(),
      }),
    )
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

  revokePairingLink: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    await revokePairingGrant(input)
  }),

  revokeAuthorizedClient: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    if (await revokeAuthorizedClient(input)) closeClientSessions(input)
  }),

  revokeCurrentClient: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.auth.kind !== 'client') {
      throw toTrpcError(expectedFailure('auth.forbidden'))
    }
    if (await revokeAuthorizedClient(ctx.auth.clientId)) closeClientSessions(ctx.auth.clientId)
  }),
})

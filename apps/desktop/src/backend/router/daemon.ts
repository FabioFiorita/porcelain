import { TRPCError } from '@trpc/server'
import { z } from 'zod'
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
  // The daemon's build version, so the client can detect and surface skew (a client
  // on a newer/older build than the daemon it's bound to) once and clearly, instead
  // of a cryptic per-procedure "No procedure found" failure. A daemon older than
  // 0.30 has no such procedure, so the client's query 404s (NOT_FOUND) — it treats
  // that as a definitely-older 'pre-0.30' rather than surfacing the raw error.
  //
  // It also carries this daemon's IDENTITY (host/platform/arch — see daemon-identity.ts)
  // so a client can name and recognize the machine it reached instead of relying on a
  // nickname the human typed. Widened rather than split into a second procedure: this
  // is already the probe every client calls, and a daemon older than that widening
  // returns `{ version }` alone — clients must read the identity fields as OPTIONAL.
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
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pairing requires HTTP or HTTPS' })
      }
      if (base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pairing endpoint must not contain credentials, query, or fragment',
        })
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
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No paired-device credential to revoke' })
    }
    if (await revokeAuthorizedClient(ctx.auth.clientId)) closeClientSessions(ctx.auth.clientId)
  }),
})

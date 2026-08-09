import { initTRPC } from '@trpc/server'
import { expectedFailure } from './daemon-composition/expected-failure'
import { formatPublicError, toTrpcError } from './daemon-composition/public-error'
import type { AuthIdentity } from './stores/access-store'

export interface DaemonTrpcContext {
  auth: AuthIdentity
  requestId: string
}

/**
 * The one tRPC builder for the daemon. Every domain router under `router/` is
 * built from THIS instance — `t.mergeRouters` refuses routers created by a
 * second `initTRPC` call, and the merge is what keeps every wire path flat.
 */
export const t = initTRPC.context<DaemonTrpcContext>().create({
  isServer: true,
  errorFormatter: formatPublicError,
})

export const publicProcedure: typeof t.procedure = t.procedure

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.kind !== 'admin') {
    throw toTrpcError(expectedFailure('auth.forbidden'))
  }
  return next()
})

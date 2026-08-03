import { initTRPC, TRPCError } from '@trpc/server'
import type { AuthIdentity } from './stores/access-store'

interface DaemonTrpcContext {
  auth: AuthIdentity
}

/**
 * The one tRPC builder for the daemon. Every domain router under `router/` is
 * built from THIS instance — `t.mergeRouters` refuses routers created by a
 * second `initTRPC` call, and the merge is what keeps every wire path flat.
 */
export const t = initTRPC.context<DaemonTrpcContext>().create({ isServer: true })

export const publicProcedure: typeof t.procedure = t.procedure

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.kind !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Host administrator access required' })
  }
  return next()
})

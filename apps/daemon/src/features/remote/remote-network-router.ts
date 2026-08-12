import { procedureCatalog } from '@porcelain/contracts'
import { adminProcedure, t } from '../../trpc'
import type { RemoteOperations } from './remote-operations'

export function createRemoteNetworkRouter(operations: RemoteOperations) {
  return t.router({
    tailnetStatus: adminProcedure
      .input(procedureCatalog.tailnetStatus.input)
      .output(procedureCatalog.tailnetStatus.output)
      .query(() => operations.tailnetStatus()),

    setTailnetBind: adminProcedure
      .input(procedureCatalog.setTailnetBind.input)
      .output(procedureCatalog.setTailnetBind.output)
      .mutation(({ input }) => operations.setTailnetBind(input)),

    lanStatus: adminProcedure
      .input(procedureCatalog.lanStatus.input)
      .output(procedureCatalog.lanStatus.output)
      .query(() => operations.lanStatus()),

    setLanBind: adminProcedure
      .input(procedureCatalog.setLanBind.input)
      .output(procedureCatalog.setLanBind.output)
      .mutation(({ input }) => operations.setLanBind(input)),

    funnelStatus: adminProcedure
      .input(procedureCatalog.funnelStatus.input)
      .output(procedureCatalog.funnelStatus.output)
      .query(() => operations.funnelStatus()),

    setFunnelBind: adminProcedure
      .input(procedureCatalog.setFunnelBind.input)
      .output(procedureCatalog.setFunnelBind.output)
      .mutation(({ input }) => operations.setFunnelBind(input)),
  })
}

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

    cloudflareStatus: adminProcedure
      .input(procedureCatalog.cloudflareStatus.input)
      .output(procedureCatalog.cloudflareStatus.output)
      .query(() => operations.cloudflareStatus()),

    setCloudflareBind: adminProcedure
      .input(procedureCatalog.setCloudflareBind.input)
      .output(procedureCatalog.setCloudflareBind.output)
      .mutation(({ input }) => operations.setCloudflareBind(input)),

    setCloudflareHostname: adminProcedure
      .input(procedureCatalog.setCloudflareHostname.input)
      .output(procedureCatalog.setCloudflareHostname.output)
      .mutation(({ input }) => operations.setCloudflareHostname(input)),
  })
}

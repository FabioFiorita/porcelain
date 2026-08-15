import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { publicProcedure, t } from '../../trpc'
import type { DevServerOperations } from './terminal-ports'

/**
 * Development-server request/response surface. Unlike a Terminal (whose create/attach/write
 * ride the WS byte stream), a server record IS data — a roster the Hub queries and three
 * explicit lifetime commands. Output is read by attaching to `terminalId` on the WS path.
 */
export function createDevServerRouter(operations: DevServerOperations) {
  return t.router({
    devServers: publicProcedure
      .input(procedureCatalog.devServers.input)
      .output(procedureCatalog.devServers.output)
      .query(({ input }) => operations.list(input)),

    startDevServer: publicProcedure
      .input(procedureCatalog.startDevServer.input)
      .output(procedureCatalog.startDevServer.output)
      .mutation(({ input }) => {
        const result = operations.start(input)
        if (!result.ok) throw expectedFailure(result.error.code)
        return result.value
      }),

    stopDevServer: publicProcedure
      .input(procedureCatalog.stopDevServer.input)
      .output(procedureCatalog.stopDevServer.output)
      .mutation(({ input }) => {
        const result = operations.stop(input.id)
        if (!result.ok) throw expectedFailure(result.error.code)
        return result.value
      }),

    dismissDevServer: publicProcedure
      .input(procedureCatalog.dismissDevServer.input)
      .output(procedureCatalog.dismissDevServer.output)
      .mutation(({ input }) => {
        const result = operations.dismiss(input.id)
        if (!result.ok) throw expectedFailure(result.error.code)
      }),
  })
}

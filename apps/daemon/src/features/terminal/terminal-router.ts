import { procedureCatalog } from '@porcelain/contracts'
import { publicProcedure, t } from '../../trpc'
import type { TerminalOperations } from './terminal-ports'

/**
 * Terminal feature router — residual request/response surface only:
 * `terminalSessions` and `renameTerminal`. Create/attach/write ride the WS stream.
 */
export function createTerminalRouter(operations: TerminalOperations) {
  return t.router({
    // The daemon-owned terminal roster — every live/exited PTY with its name, cwd, and
    // status. The renderer hydrates its sidebar list from this (filtered to the current
    // repo) on repo open and on daemon reconnect, so a still-running session reappears
    // after a reload. Create/attach/write ride the WS session (byte streams); list/rename
    // are plain request/response, so they live here.
    terminalSessions: publicProcedure
      .input(procedureCatalog.terminalSessions.input)
      .output(procedureCatalog.terminalSessions.output)
      .query(() => operations.list()),

    renameTerminal: publicProcedure
      .input(procedureCatalog.renameTerminal.input)
      .output(procedureCatalog.renameTerminal.output)
      .mutation(({ input }) => {
        operations.rename(input.id, input.name)
      }),
  })
}

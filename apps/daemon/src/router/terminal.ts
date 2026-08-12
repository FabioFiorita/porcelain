import { procedureCatalog } from '@porcelain/contracts'
import type { TerminalOperations } from '../features/terminal'
import { publicProcedure, t } from '../trpc'

export function createTerminalRouter(terminal: TerminalOperations) {
  return t.router({
    // The daemon-owned terminal roster — every live/exited PTY with its name, cwd, and
    // status. The renderer hydrates its sidebar list from this (filtered to the current
    // repo) on repo open and on daemon reconnect, so a still-running session reappears
    // after a reload. Create/attach/write ride the WS session (byte streams); list/rename
    // are plain request/response, so they live here.
    terminalSessions: publicProcedure
      .input(procedureCatalog.terminalSessions.input)
      .output(procedureCatalog.terminalSessions.output)
      .query(() => terminal.list()),

    renameTerminal: publicProcedure
      .input(procedureCatalog.renameTerminal.input)
      .output(procedureCatalog.renameTerminal.output)
      .mutation(({ input }) => {
        terminal.rename(input.id, input.name)
      }),
  })
}

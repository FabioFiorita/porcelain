import type { RenameTerminalInput, TerminalSessionsOutput } from '@porcelain/contracts/terminal'
import { terminalProcedures } from '@porcelain/contracts/terminal'
import type { trpcClient } from '@renderer/lib/trpc'

/** Vanilla tRPC surface the Terminal roster/rename helpers need. */
export type TerminalTransportClient = Pick<typeof trpcClient, 'terminalSessions' | 'renameTerminal'>

/** List every live/exited PTY on the given daemon, parsed through the contract output. */
export async function listTerminalSessionsOnDaemon(
  client: TerminalTransportClient,
): Promise<TerminalSessionsOutput> {
  const sessions = client.terminalSessions
  const raw = await sessions.query()
  return terminalProcedures.terminalSessions.output.parse(raw)
}

/** Rename a session on the given daemon. Void output is contract-parsed. */
export async function renameTerminalOnDaemon(
  client: TerminalTransportClient,
  input: RenameTerminalInput,
): Promise<void> {
  const rename = client.renameTerminal
  const raw = await rename.mutate(input)
  terminalProcedures.renameTerminal.output.parse(raw)
}

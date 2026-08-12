import type { TerminalInfo } from '@porcelain/contracts/terminal'

export const TERMINAL_ROSTER_POLL_MS = 5_000

export function terminalSessionsForRepo(
  sessions: readonly TerminalInfo[],
  repoPath: string,
): TerminalInfo[] {
  if (repoPath === '') return []
  return sessions.filter(
    (session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`),
  )
}

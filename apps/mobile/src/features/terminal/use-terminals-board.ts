import {
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  type TerminalGroup,
  type TerminalLocation,
  terminalLocations,
} from '@porcelain/client-runtime/terminal'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { useMemo } from 'react'
import { useHubInventories, useProjectDirectories } from '@/features/projects'
import { useActiveEnvironment } from '@/features/remote'

export type TerminalsBoard = {
  /** What the Environment section is called: the paired daemon's nickname. */
  environmentLabel: string
  /** The daemon host's home directory — where an Environment shell starts. */
  environmentRoot: string | null
  /** Environment first, then Project · Worktree, then Elsewhere. Empty groups are absent. */
  groups: readonly TerminalGroup[]
  /** The Environment's own shells, already split out of `groups` for the shortcuts. */
  environmentSessions: readonly TerminalInfo[]
  /** Every Worktree a new terminal may be started in. */
  locations: readonly TerminalLocation[]
}

/**
 * Everything the Terminals list needs besides the sessions themselves.
 *
 * A terminal on the wire is a uuid plus `{name, cwd, status, exitCode, createdAt}` — no project,
 * worktree or environment id — so ownership is resolved on this side by longest `cwd` prefix
 * against the Hub inventory. That rule is shared with the web board rather than reimplemented.
 *
 * The inventory comes from `useHubInventories` and is narrowed to the ACTIVE Environment: the
 * sessions were read from that daemon alone, so naming them with another daemon's directories
 * would be a coincidence, not a match. It is also the only inventory read that does not require
 * a checkout to be selected first, which is what lets the Environment group work on a cold app.
 */
export function useTerminalsBoard(
  active: boolean,
  sessions: readonly TerminalInfo[],
): TerminalsBoard {
  const environment = useActiveEnvironment()
  const inventories = useHubInventories()
  // The Environment root is the daemon host's home — the same directory the Project browser
  // starts in, which is what `null` asks `browseDirectories` for.
  const environmentRoot = useProjectDirectories(null, active).result?.path ?? null

  const projects = useMemo(
    () =>
      inventories.find((entry) => entry.environment.id === environment?.id)?.inventory.projects ??
      [],
    [environment?.id, inventories],
  )
  const locations = useMemo(() => terminalLocations(projects), [projects])
  const groups = useMemo(
    () => groupTerminalSessions(sessions, locations, environmentRoot),
    [environmentRoot, locations, sessions],
  )
  const environmentSessions = useMemo(
    () => groups.find((group) => group.key === ENVIRONMENT_GROUP_KEY)?.sessions ?? [],
    [groups],
  )

  return {
    environmentLabel: environment?.nickname ?? 'Environment',
    environmentRoot,
    environmentSessions,
    groups,
    locations,
  }
}

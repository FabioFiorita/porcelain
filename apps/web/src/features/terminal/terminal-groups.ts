import type { HubProject } from '@porcelain/contracts/projects'
import type { TerminalInfo } from '@porcelain/contracts/terminal'

/**
 * Cross-project grouping for the Terminals board.
 *
 * A daemon terminal knows only its `cwd` (see `terminalInfoSchema`) — there is no
 * project or worktree id on the wire. The Hub inventory is the only thing that can
 * name a directory, so the board resolves ownership here by LONGEST path prefix:
 * a worktree nested inside another checkout wins over its parent, and a shell opened
 * in a subdirectory still lands in its worktree. Everything the inventory cannot claim
 * (a shell spawned in `$HOME`, or a project removed from the Hub while its PTY lives on)
 * falls into one trailing "Elsewhere" group rather than disappearing — the board's whole
 * promise is that every live session is visible somewhere.
 *
 * Pure on purpose: the view passes daemon data straight in, so the grouping rule is
 * testable without a daemon, a query client, or a DOM.
 */

/** A directory the Hub can name, flattened from the inventory for prefix matching. */
export interface TerminalLocation {
  /** `<projectId>:<worktreeId>`; stable for a React key and for the picker's value. */
  key: string
  projectName: string
  worktreeName: string
  path: string
}

export interface TerminalGroup {
  /** `<projectId>:<worktreeId>`, `environment`, or `elsewhere`. */
  key: string
  /** Project name, `Environment`, or `Elsewhere`. */
  label: string
  /** Worktree name; `null` for the unmatched bucket. */
  worktreeName: string | null
  /** Directory the group's terminals were spawned under; `null` when unmatched. */
  path: string | null
  sessions: TerminalInfo[]
}

export const ELSEWHERE_GROUP_KEY = 'elsewhere'
/** The Environment's own shells: under the daemon host's home, claimed by no Project. */
export const ENVIRONMENT_GROUP_KEY = 'environment'

/** Every worktree the Hub knows, flattened and sorted for the "New terminal" picker. */
export function terminalLocations(projects: readonly HubProject[]): TerminalLocation[] {
  return projects
    .flatMap((project) =>
      project.worktrees.map((worktree) => ({
        key: `${project.id}:${worktree.id}`,
        projectName: project.name,
        worktreeName: worktree.name,
        path: worktree.path,
      })),
    )
    .sort(
      (a, b) =>
        a.projectName.localeCompare(b.projectName) || a.worktreeName.localeCompare(b.worktreeName),
    )
}

/** True when `cwd` is `path` itself or a directory under it. */
function isUnder(cwd: string, path: string): boolean {
  return cwd === path || cwd.startsWith(`${path}/`)
}

/** The most specific location containing `cwd`, or null when the Hub cannot name it. */
export function locationForCwd(
  cwd: string,
  locations: readonly TerminalLocation[],
): TerminalLocation | null {
  let best: TerminalLocation | null = null
  for (const location of locations) {
    if (!isUnder(cwd, location.path)) continue
    if (best === null || location.path.length > best.path.length) best = location
  }
  return best
}

/**
 * Sessions bucketed by the worktree they run in. Empty locations are omitted — the board
 * lists live terminals, not the Hub tree — and "Elsewhere" appears only when something
 * lands in it. Sessions keep a stable order (oldest first, then id) so the list does not
 * reshuffle under the five-second roster poll.
 */
export function groupTerminalSessions(
  sessions: readonly TerminalInfo[],
  locations: readonly TerminalLocation[],
  environmentRoot: string | null = null,
): TerminalGroup[] {
  const groups = new Map<string, TerminalGroup>()
  const ordered = [...sessions].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  )

  for (const session of ordered) {
    const location = locationForCwd(session.cwd, locations)
    const atEnvironment =
      location === null && environmentRoot !== null && isUnder(session.cwd, environmentRoot)
    const key = location?.key ?? (atEnvironment ? ENVIRONMENT_GROUP_KEY : ELSEWHERE_GROUP_KEY)
    const existing = groups.get(key)
    if (existing !== undefined) {
      existing.sessions.push(session)
      continue
    }
    groups.set(key, {
      key,
      label: location?.projectName ?? (atEnvironment ? 'Environment' : 'Elsewhere'),
      worktreeName: location?.worktreeName ?? null,
      path: location?.path ?? (atEnvironment ? environmentRoot : null),
      sessions: [session],
    })
  }

  const named = [...groups.values()].filter(
    (group) => group.key !== ELSEWHERE_GROUP_KEY && group.key !== ENVIRONMENT_GROUP_KEY,
  )
  named.sort(
    (a, b) =>
      a.label.localeCompare(b.label) || (a.worktreeName ?? '').localeCompare(b.worktreeName ?? ''),
  )
  // The Environment leads and Elsewhere trails: the human's own machine is the frame the
  // Projects sit inside, and the unclaimed bucket is the one nobody is looking for.
  const environment = groups.get(ENVIRONMENT_GROUP_KEY)
  const elsewhere = groups.get(ELSEWHERE_GROUP_KEY)
  return [
    ...(environment === undefined ? [] : [environment]),
    ...named,
    ...(elsewhere === undefined ? [] : [elsewhere]),
  ]
}

import { type TerminalLocation, terminalLocationLabel } from '@porcelain/client-runtime/terminal'
import type { TerminalInfo } from '@porcelain/contracts/terminal'

/**
 * The Terminals tab's decisions, without a view.
 *
 * Everything here is a rule the board has to get right and a screen test cannot reach: which
 * shell a multiplexer shortcut reuses, where a new terminal may be started, and what the list
 * says about itself. The grouping rule proper is shared with the web board
 * (`@porcelain/client-runtime/terminal`) — this is the phone's half on top of it.
 */

/** A named shell the Environment row can open. */
export type EnvironmentShell = {
  key: string
  label: string
  /** The literal roster name it is found again by. */
  name: string
  /** Typed into the shell as it starts. A create-time field — never a write into a live one. */
  initialInput: string
}

/**
 * Shells the Environment row can start. Fixed literal names, not the Environment nickname:
 * these are found again BY name on the next visit, and a nickname is display text the human
 * can change at any time. `initialInput` is a create-time field, so a multiplexer shortcut is
 * a spawn, never a write into an existing shell.
 */
export const ENVIRONMENT_SHELLS: readonly EnvironmentShell[] = [
  { initialInput: 'herdr', key: 'herdr', label: 'herdr', name: 'herdr' },
  { initialInput: 'tmux new -A -s porcelain', key: 'tmux', label: 'tmux', name: 'tmux' },
]

/**
 * The Environment shell with this exact name, if one is still running.
 *
 * Scoped to the sessions handed in — the Environment group's — so a `herdr` running inside a
 * worktree is never what the Environment shortcut opens. Exited is not a match: its PTY is
 * gone, and the point of the shortcut is to reach a live multiplexer.
 */
export function runningShellNamed(
  sessions: readonly TerminalInfo[],
  name: string,
): TerminalInfo | null {
  return sessions.find((session) => session.name === name && session.status === 'running') ?? null
}

/** A directory the "New terminal" picker offers. */
export type NewTerminalOption = {
  key: string
  label: string
  /** The worktree under the project, or null for the Environment's own root. */
  detail: string | null
  path: string
}

/**
 * Where a new shell may be started: the Environment's own root first, then every Worktree the
 * Hub can name.
 *
 * The Environment root is omitted rather than disabled when the daemon has not answered with a
 * home directory yet — `cwd` is required by `terminalCreateSchema`, so an option with nowhere
 * to run is an option that cannot be taken.
 */
export function newTerminalOptions({
  environmentLabel,
  environmentRoot,
  locations,
}: {
  environmentLabel: string
  environmentRoot: string | null
  locations: readonly TerminalLocation[]
}): NewTerminalOption[] {
  const environment: NewTerminalOption[] =
    environmentRoot === null
      ? []
      : [{ detail: null, key: 'environment', label: environmentLabel, path: environmentRoot }]
  return [
    ...environment,
    // Same naming as the web picker: the Project titles the row, and the checkout under it is
    // "Root" when it is the Project's own — not the repeated Project name.
    ...locations.map((location) => ({
      detail: terminalLocationLabel(location),
      key: location.key,
      label: location.projectName,
      path: location.path,
    })),
  ]
}

/**
 * The line under the title: what this device currently knows about the daemon's shells.
 *
 * Until the first read lands there is no honest count to print — "no terminals" would read as
 * a fact about the daemon rather than about this client.
 */
export function rosterSummary(
  sessions: readonly TerminalInfo[],
  { isLoading, paired }: { isLoading: boolean; paired: boolean },
): string {
  if (!paired) return 'No environment paired'
  if (isLoading && sessions.length === 0) return 'Loading terminals…'
  if (sessions.length === 0) return 'No terminals'
  const running = sessions.filter((session) => session.status === 'running').length
  const exited = sessions.length - running
  return `${running} running${exited > 0 ? ` · ${exited} exited` : ''}`
}

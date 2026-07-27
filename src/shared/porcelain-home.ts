import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Root directory for agent channels, the daemon token, and the installed CLI.
 *
 * Default: `~/.porcelain` (production / daily-driver daemon).
 * Override: `PORCELAIN_HOME` — used by the **dev** stack (`~/.porcelain-dev`) so
 * product work never touches the always-on work daemon's channels or token.
 *
 * Per-file env vars (e.g. `PORCELAIN_BOARD`) still win when set (tests, e2e).
 */
export function porcelainHome(): string {
  return process.env.PORCELAIN_HOME ?? join(homedir(), '.porcelain')
}

/** `join(porcelainHome(), ...parts)` — channel paths, token, CLI install dir. */
export function porcelainHomePath(...parts: string[]): string {
  return join(porcelainHome(), ...parts)
}

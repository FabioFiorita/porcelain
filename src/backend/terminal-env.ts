/**
 * Build the environment for a spawned PTY from the daemon's own env. Pure and
 * extracted from terminal-manager (the one impure module — it spawns) so the
 * sanitization is unit-testable.
 *
 * SECURITY: the daemon's process env carries secrets and process-mode flags
 * that must NEVER leak into a user shell — `env` in the terminal would print
 * the session token, and ELECTRON_RUN_AS_NODE=1 would make any Electron-based
 * binary launched from the terminal silently run as plain Node. Everything the
 * shell spawn passed for the DAEMON's benefit is stripped; the user's real
 * environment passes through untouched.
 */
const DAEMON_ONLY_ENV = [
  // Would flip any Electron binary the user launches into plain-Node mode.
  'ELECTRON_RUN_AS_NODE',
  // The session token — a secret; `env` prints the environment.
  'PORCELAIN_DAEMON_TOKEN',
  // Daemon configuration knobs, meaningless (or misleading) inside a shell.
  'PORCELAIN_DAEMON_PORT',
  'PORCELAIN_USER_DATA',
  'PORCELAIN_DEV',
  'PORCELAIN_ALLOWED_ORIGIN',
  // Harness knobs read by the daemon/shell processes themselves (defaultShell,
  // preload), never inside a spawned shell — verified unused there.
  'PORCELAIN_E2E',
  'PORCELAIN_SHELL',
]

export function terminalEnv(source: NodeJS.ProcessEnv): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !DAEMON_ONLY_ENV.includes(key)) env[key] = value
  }
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  return env
}

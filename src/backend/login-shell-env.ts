import { execFile } from 'node:child_process'
import { delimiter } from 'node:path'
import { promisify } from 'node:util'
import { terminalEnv } from './terminal-env'

/**
 * The login-shell PATH resolver for agent-CLI spawns.
 *
 * WHY this exists: a Dock/Finder-launched daemon inherits launchd's minimal PATH
 * (~`/usr/bin:/bin:/usr/sbin:/sbin`). The drivers already probe well-known locations to
 * find the CLI *binary* itself, but the CLI they spawn inherits that minimal PATH — so an
 * MCP server the user configured inside the CLI's own config as `npx foo` / `node …` /
 * `bun …` can't resolve, failing in the packaged app while working from a terminal. The
 * embedded terminal's PTYs never hit this because they spawn login shells. So we resolve
 * the login shell's PATH ONCE and merge it into every agent-CLI child's env.
 *
 * SECURITY: the resolver spawns the user's own login shell, so its child env MUST be
 * `terminalEnv(process.env)` — rc files can read the environment, and the daemon token
 * (plus `ELECTRON_RUN_AS_NODE` and the other daemon-only knobs) must never reach a user
 * shell (the terminal-env audit invariant). Electron-free + dependency-light: this lives
 * in the daemon package.
 */

const execFileAsync = promisify(execFile)

// Cap the shell startup so a hung rc file can't stall the first turn (SIGTERM on timeout).
const LOGIN_SHELL_TIMEOUT_MS = 8_000

/**
 * The user's login shell binary. Mirrors terminal-manager's PTY pick — an absolute `SHELL`
 * wins — but without the `PORCELAIN_SHELL` escape hatch (that's a terminal-only knob, and
 * `terminalEnv` scrubs it anyway) and falling back per-platform: zsh on macOS (the default
 * login shell), bash elsewhere.
 */
export function loginShell(): string {
  const shell = process.env.SHELL
  if (shell?.startsWith('/')) return shell
  return process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
}

/**
 * Pull the PATH out of the login shell's printed output. `printf %s "$PATH"` emits the
 * PATH with no trailing newline, so a shell that prints warnings first (fish, a chatty rc)
 * leaves the real value as the LAST line. Validate it looks like a PATH (has at least one
 * `/`); anything else — empty output, a warning-only line — yields null. Pure + exported
 * for unit testing.
 */
export function parseLoginPath(stdout: string): string | null {
  const last = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .at(-1)
  if (last === undefined || !last.includes('/')) return null
  return last
}

/**
 * Merge the login PATH in front of the current PATH: login segments first (so a
 * Homebrew/asdf dir the login shell adds shadows the minimal one), then any current-PATH
 * segment not already present appended (never lose what we had). Empty segments are
 * dropped and duplicates deduped. Pure + exported — this is the piece worth unit-testing;
 * the impure resolver is not.
 */
export function mergePathSegments(loginPath: string | null, currentPath: string): string {
  const segments: string[] = []
  const seen = new Set<string>()
  for (const source of [loginPath ?? '', currentPath]) {
    for (const segment of source.split(delimiter)) {
      if (segment === '' || seen.has(segment)) continue
      seen.add(segment)
      segments.push(segment)
    }
  }
  return segments.join(delimiter)
}

// The in-flight (then resolved) promise, cached module-level so the shell is spawned at
// most once per daemon lifetime. Reset only from tests.
let loginPathPromise: Promise<string | null> | null = null

async function probeLoginShellPath(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(loginShell(), ['-l', '-c', 'printf %s "$PATH"'], {
      // Scrubbed env: the token / RUN_AS_NODE must never reach the user's rc files.
      env: terminalEnv(process.env),
      timeout: LOGIN_SHELL_TIMEOUT_MS,
    })
    return parseLoginPath(stdout)
  } catch {
    // Missing shell, timeout, empty output — degrade quietly to null (agentSpawnEnv then
    // keeps the plain scrubbed env, exactly as before this module existed).
    return null
  }
}

/**
 * Resolve the login shell's PATH once (subsequent calls share the cached promise). Kicked
 * fire-and-forget at daemon startup so the first turn doesn't pay the shell-startup cost.
 */
export function resolveLoginShellPath(): Promise<string | null> {
  if (loginPathPromise === null) loginPathPromise = probeLoginShellPath()
  return loginPathPromise
}

/** Drop the cached resolution — tests only. */
export function resetLoginShellPathCache(): void {
  loginPathPromise = null
}

/**
 * The env for an agent-CLI child spawn: `terminalEnv(process.env)` with PATH replaced by
 * the login PATH merged over the current one. When resolution failed (null), the plain
 * scrubbed env is returned unchanged.
 */
export async function agentSpawnEnv(): Promise<Record<string, string>> {
  const env = terminalEnv(process.env)
  const loginPath = await resolveLoginShellPath()
  if (loginPath === null) return env
  env.PATH = mergePathSegments(loginPath, env.PATH ?? '')
  return env
}
